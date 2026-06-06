-- Phase 4: Notifications system + automatic triggers

-- ============ Core tables (idempotent) ============
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  sender_id UUID,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(user_id) WHERE is_read = false;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users see own notifications" ON public.notifications;
CREATE POLICY "users see own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "users update own notifications" ON public.notifications;
CREATE POLICY "users update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "users delete own notifications" ON public.notifications;
CREATE POLICY "users delete own notifications" ON public.notifications
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_push_subs_user ON public.push_subscriptions(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users manage own subs" ON public.push_subscriptions;
CREATE POLICY "users manage own subs" ON public.push_subscriptions
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.app_secrets (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.app_secrets TO service_role;
ALTER TABLE public.app_secrets ENABLE ROW LEVEL SECURITY;
-- no authenticated policy: server-only

CREATE TABLE IF NOT EXISTS public.auth_branding (
  id INT PRIMARY KEY DEFAULT 1,
  logo_url TEXT,
  hero_url TEXT,
  app_title TEXT,
  app_subtitle TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT auth_branding_singleton CHECK (id = 1)
);
INSERT INTO public.auth_branding (id) VALUES (1) ON CONFLICT DO NOTHING;
GRANT SELECT ON public.auth_branding TO anon, authenticated;
GRANT ALL ON public.auth_branding TO service_role;
ALTER TABLE public.auth_branding ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone reads branding" ON public.auth_branding;
CREATE POLICY "anyone reads branding" ON public.auth_branding
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "admin updates branding" ON public.auth_branding;
CREATE POLICY "admin updates branding" ON public.auth_branding
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'developer'));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- ============ Helpers ============
CREATE OR REPLACE FUNCTION public.notify_role(_role app_role, _type TEXT, _title TEXT, _body TEXT, _link TEXT, _data JSONB)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n INT;
BEGIN
  WITH ins AS (
    INSERT INTO public.notifications(user_id, type, title, body, link, data)
    SELECT ur.user_id, _type, _title, _body, _link, _data
    FROM public.user_roles ur WHERE ur.role = _role
    RETURNING 1
  ) SELECT count(*) INTO n FROM ins;
  RETURN COALESCE(n, 0);
END $$;

CREATE OR REPLACE FUNCTION public.notify_user(_user_id UUID, _type TEXT, _title TEXT, _body TEXT, _link TEXT, _data JSONB)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.notifications(user_id, type, title, body, link, data)
  VALUES (_user_id, _type, _title, _body, _link, _data);
$$;

-- ============ Triggers ============

-- 1) New online order → admin + sales_manager + cashier
CREATE OR REPLACE FUNCTION public.tg_notify_new_online_order()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.notify_role('admin','order_new',
    'طلب أونلاين جديد',
    'طلب #' || COALESCE(NEW.order_number,'—') || ' بقيمة ' || COALESCE(NEW.total::text,'0'),
    '/online-orders',
    jsonb_build_object('order_id', NEW.id));
  PERFORM public.notify_role('sales_manager','order_new',
    'طلب أونلاين جديد',
    'طلب #' || COALESCE(NEW.order_number,'—'),
    '/online-orders',
    jsonb_build_object('order_id', NEW.id));
  PERFORM public.notify_role('cashier','order_new',
    'طلب أونلاين جديد',
    'طلب #' || COALESCE(NEW.order_number,'—'),
    '/online-orders',
    jsonb_build_object('order_id', NEW.id));
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_new_online_order ON public.online_orders;
CREATE TRIGGER trg_notify_new_online_order
AFTER INSERT ON public.online_orders
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_new_online_order();

-- 2) Leave request status change → notify employee (employees.user_id)
CREATE OR REPLACE FUNCTION public.tg_notify_leave_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid UUID; v_title TEXT;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  SELECT user_id INTO v_uid FROM public.employees WHERE id = NEW.employee_id;
  IF v_uid IS NULL THEN RETURN NEW; END IF;
  v_title := CASE NEW.status
    WHEN 'approved' THEN 'تم اعتماد طلب الإجازة'
    WHEN 'rejected' THEN 'تم رفض طلب الإجازة'
    ELSE 'تحديث طلب الإجازة' END;
  PERFORM public.notify_user(v_uid,'leave_status', v_title,
    NEW.leave_type || ' من ' || NEW.from_date || ' إلى ' || NEW.to_date,
    '/hr', jsonb_build_object('leave_id', NEW.id, 'status', NEW.status));
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_leave_status ON public.leave_requests;
CREATE TRIGGER trg_notify_leave_status
AFTER UPDATE OF status ON public.leave_requests
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_leave_status();

-- 3) New leave request → notify HR + manager
CREATE OR REPLACE FUNCTION public.tg_notify_leave_new()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_name TEXT;
BEGIN
  SELECT full_name INTO v_name FROM public.employees WHERE id = NEW.employee_id;
  PERFORM public.notify_role('hr','leave_new',
    'طلب إجازة جديد',
    COALESCE(v_name,'موظف') || ' — ' || NEW.leave_type,
    '/hr', jsonb_build_object('leave_id', NEW.id));
  PERFORM public.notify_role('manager','leave_new',
    'طلب إجازة جديد',
    COALESCE(v_name,'موظف') || ' — ' || NEW.leave_type,
    '/hr', jsonb_build_object('leave_id', NEW.id));
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_leave_new ON public.leave_requests;
CREATE TRIGGER trg_notify_leave_new
AFTER INSERT ON public.leave_requests
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_leave_new();

-- 4) Low stock on inventory update → notify admin + warehouse
CREATE OR REPLACE FUNCTION public.tg_notify_low_stock()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_min NUMERIC; v_name TEXT;
BEGIN
  SELECT min_stock, name_ar INTO v_min, v_name FROM public.products WHERE id = NEW.product_id;
  IF v_min IS NULL OR v_min <= 0 THEN RETURN NEW; END IF;
  IF NEW.quantity > v_min THEN RETURN NEW; END IF;
  -- only fire when crossing the threshold (avoid spam)
  IF TG_OP = 'UPDATE' AND OLD.quantity <= v_min THEN RETURN NEW; END IF;
  PERFORM public.notify_role('admin','stock_low',
    'تنبيه: مخزون منخفض',
    COALESCE(v_name,'منتج') || ' — الرصيد: ' || NEW.quantity || ' (الحد: ' || v_min || ')',
    '/inventory', jsonb_build_object('product_id', NEW.product_id));
  PERFORM public.notify_role('warehouse','stock_low',
    'تنبيه: مخزون منخفض',
    COALESCE(v_name,'منتج') || ' — الرصيد: ' || NEW.quantity,
    '/inventory', jsonb_build_object('product_id', NEW.product_id));
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_low_stock ON public.inventory;
CREATE TRIGGER trg_notify_low_stock
AFTER INSERT OR UPDATE OF quantity ON public.inventory
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_low_stock();

-- 5) Sales invoice marked overdue → notify admin + accountant
CREATE OR REPLACE FUNCTION public.tg_notify_invoice_overdue()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'overdue' AND (OLD.status IS DISTINCT FROM 'overdue') THEN
    PERFORM public.notify_role('admin','invoice_overdue',
      'فاتورة متأخرة',
      'فاتورة #' || COALESCE(NEW.invoice_number,'—') || ' — المتبقي: ' || (NEW.total - COALESCE(NEW.paid,0))::text,
      '/sales', jsonb_build_object('invoice_id', NEW.id));
    PERFORM public.notify_role('accountant','invoice_overdue',
      'فاتورة متأخرة',
      'فاتورة #' || COALESCE(NEW.invoice_number,'—'),
      '/sales', jsonb_build_object('invoice_id', NEW.id));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_invoice_overdue ON public.sales_invoices;
CREATE TRIGGER trg_notify_invoice_overdue
AFTER UPDATE OF status ON public.sales_invoices
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_invoice_overdue();
