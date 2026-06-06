
-- ============================================
-- 2) Tenants table (companies/customers of the system)
-- ============================================
CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  logo_url TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  plan TEXT NOT NULL DEFAULT 'standard',
  status TEXT NOT NULL DEFAULT 'active',
  max_users INTEGER DEFAULT 50,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenants TO authenticated;
GRANT ALL ON public.tenants TO service_role;

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Tenants visible to developer (all) and to members of that tenant
CREATE POLICY "tenants_developer_all" ON public.tenants
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'developer'))
  WITH CHECK (public.has_role(auth.uid(), 'developer'));

CREATE POLICY "tenants_member_read" ON public.tenants
  FOR SELECT TO authenticated USING (true);

-- ============================================
-- 3) Insert default tenant for existing data
-- ============================================
INSERT INTO public.tenants (id, name, slug, plan, status, notes)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'الشركة الافتراضية',
  'default',
  'enterprise',
  'active',
  'الشركة الرئيسية - تحتوي على كل البيانات الموجودة'
) ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 4) Tenant modules (which features each tenant can access)
-- ============================================
CREATE TABLE IF NOT EXISTS public.tenant_modules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, module_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_modules TO authenticated;
GRANT ALL ON public.tenant_modules TO service_role;

ALTER TABLE public.tenant_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "modules_developer_all" ON public.tenant_modules
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'developer'))
  WITH CHECK (public.has_role(auth.uid(), 'developer'));

CREATE POLICY "modules_member_read" ON public.tenant_modules
  FOR SELECT TO authenticated USING (true);

-- Seed all modules enabled for default tenant
INSERT INTO public.tenant_modules (tenant_id, module_key, enabled) VALUES
  ('00000000-0000-0000-0000-000000000001', 'sales', true),
  ('00000000-0000-0000-0000-000000000001', 'pos', true),
  ('00000000-0000-0000-0000-000000000001', 'inventory', true),
  ('00000000-0000-0000-0000-000000000001', 'purchases', true),
  ('00000000-0000-0000-0000-000000000001', 'accounting', true),
  ('00000000-0000-0000-0000-000000000001', 'finance', true),
  ('00000000-0000-0000-0000-000000000001', 'hr', true),
  ('00000000-0000-0000-0000-000000000001', 'payroll', true),
  ('00000000-0000-0000-0000-000000000001', 'reps', true),
  ('00000000-0000-0000-0000-000000000001', 'supervisor', true),
  ('00000000-0000-0000-0000-000000000001', 'reports', true),
  ('00000000-0000-0000-0000-000000000001', 'ai_forecast', true)
ON CONFLICT (tenant_id, module_key) DO NOTHING;

-- ============================================
-- 5) Add tenant_id to user_roles
-- ============================================
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

UPDATE public.user_roles SET tenant_id = '00000000-0000-0000-0000-000000000001'
  WHERE tenant_id IS NULL AND role != 'developer';

-- ============================================
-- 6) Add tenant_id to profiles
-- ============================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL;

UPDATE public.profiles SET tenant_id = '00000000-0000-0000-0000-000000000001'
  WHERE tenant_id IS NULL;

-- ============================================
-- 7) Add tenant_id to all major data tables
-- ============================================
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'customers','products','categories','suppliers','warehouses','inventory','stock_movements',
    'sales_invoices','sales_invoice_items','customer_payments','supplier_payments',
    'expenses','expense_categories','accounts','account_transfers','payments','payment_methods',
    'chart_accounts','journal_entries','journal_entry_lines',
    'employees','attendance','leave_requests','salary_advances','bonuses','penalties',
    'payroll_runs','payroll_items','company_settings',
    'rep_check_ins','rep_visits','rep_routes'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE', t);
    EXECUTE format('UPDATE public.%I SET tenant_id = %L WHERE tenant_id IS NULL', t, '00000000-0000-0000-0000-000000000001');
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_tenant ON public.%I(tenant_id)', t, t);
  END LOOP;
END $$;

-- ============================================
-- 8) Helper functions
-- ============================================
CREATE OR REPLACE FUNCTION public.is_developer(_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'developer')
$$;

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS UUID
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT tenant_id FROM public.user_roles
  WHERE user_id = auth.uid() AND tenant_id IS NOT NULL
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.module_enabled(_module_key TEXT, _tenant_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT enabled FROM public.tenant_modules
     WHERE tenant_id = COALESCE(_tenant_id, public.current_tenant_id())
       AND module_key = _module_key
     LIMIT 1),
    true
  )
$$;

-- ============================================
-- 9) Updated handle_new_user to assign default tenant
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  user_count INT;
  default_tenant UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
  INSERT INTO public.profiles (id, email, full_name, tenant_id)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), default_tenant);

  SELECT COUNT(*) INTO user_count FROM auth.users;
  IF user_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role, tenant_id) VALUES (NEW.id, 'admin', default_tenant);
  ELSE
    INSERT INTO public.user_roles (user_id, role, tenant_id) VALUES (NEW.id, 'cashier', default_tenant);
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================
-- 10) Trigger to update updated_at for new tables
-- ============================================
DROP TRIGGER IF EXISTS trg_tenants_updated ON public.tenants;
CREATE TRIGGER trg_tenants_updated BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

DROP TRIGGER IF EXISTS trg_tenant_modules_updated ON public.tenant_modules;
CREATE TRIGGER trg_tenant_modules_updated BEFORE UPDATE ON public.tenant_modules
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();
