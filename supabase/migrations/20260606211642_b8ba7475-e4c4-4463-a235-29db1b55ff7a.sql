
-- Audit log table
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id TEXT,
  action TEXT NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
  user_id UUID,
  user_email TEXT,
  old_data JSONB,
  new_data JSONB,
  changed_fields TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_table ON public.audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON public.audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON public.audit_log(created_at DESC);

GRANT SELECT, DELETE ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Developers can view audit log"
  ON public.audit_log FOR SELECT
  TO authenticated
  USING (public.is_developer(auth.uid()));

CREATE POLICY "Developers can delete audit log"
  ON public.audit_log FOR DELETE
  TO authenticated
  USING (public.is_developer(auth.uid()));

-- Generic audit trigger function
CREATE OR REPLACE FUNCTION public.tg_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_user_email TEXT;
  v_record_id TEXT;
  v_old JSONB;
  v_new JSONB;
  v_changed TEXT[] := ARRAY[]::TEXT[];
  v_key TEXT;
BEGIN
  SELECT email INTO v_user_email FROM public.profiles WHERE id = v_user_id LIMIT 1;

  IF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD);
    v_record_id := (v_old->>'id');
  ELSIF TG_OP = 'INSERT' THEN
    v_new := to_jsonb(NEW);
    v_record_id := (v_new->>'id');
  ELSE
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_record_id := (v_new->>'id');
    FOR v_key IN SELECT jsonb_object_keys(v_new) LOOP
      IF v_old->v_key IS DISTINCT FROM v_new->v_key THEN
        v_changed := array_append(v_changed, v_key);
      END IF;
    END LOOP;
    IF array_length(v_changed,1) IS NULL THEN
      RETURN NEW;
    END IF;
  END IF;

  INSERT INTO public.audit_log (table_name, record_id, action, user_id, user_email, old_data, new_data, changed_fields)
  VALUES (TG_TABLE_NAME, v_record_id, TG_OP, v_user_id, v_user_email, v_old, v_new, v_changed);

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- Attach triggers to sensitive tables
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'sales_invoices','sales_invoice_items','expenses','customer_payments','supplier_payments',
    'payroll_runs','payroll_items','employees','products','customers','suppliers',
    'journal_entries','online_orders','attendance','leave_requests','salary_advances',
    'penalties','bonuses','account_transfers','stock_movements','user_roles','user_screen_permissions'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS tg_audit_%I ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER tg_audit_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.tg_audit_log()', t, t);
  END LOOP;
END $$;
