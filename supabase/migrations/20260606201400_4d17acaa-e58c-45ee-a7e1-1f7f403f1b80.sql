
CREATE TABLE IF NOT EXISTS public.late_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  request_date DATE NOT NULL DEFAULT CURRENT_DATE,
  late_minutes INT NOT NULL CHECK (late_minutes > 0 AND late_minutes <= 480),
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_late_permissions_employee ON public.late_permissions(employee_id);
CREATE INDEX IF NOT EXISTS idx_late_permissions_tenant ON public.late_permissions(tenant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.late_permissions TO authenticated;
GRANT ALL ON public.late_permissions TO service_role;

ALTER TABLE public.late_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lp_read" ON public.late_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "lp_write" ON public.late_permissions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Auto-provision employee record from profile when missing
CREATE OR REPLACE FUNCTION public.ensure_employee_for_user(_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emp_id UUID;
  v_profile RECORD;
  v_code TEXT;
BEGIN
  SELECT id INTO v_emp_id FROM public.employees WHERE user_id = _user_id LIMIT 1;
  IF v_emp_id IS NOT NULL THEN RETURN v_emp_id; END IF;

  SELECT p.email, p.full_name, p.tenant_id INTO v_profile
  FROM public.profiles p WHERE p.id = _user_id LIMIT 1;

  v_code := 'EMP-' || substr(_user_id::text, 1, 8);

  INSERT INTO public.employees (employee_code, full_name, email, user_id, hire_date, position, tenant_id, is_active)
  VALUES (
    v_code,
    COALESCE(v_profile.full_name, v_profile.email, 'Employee'),
    v_profile.email,
    _user_id,
    CURRENT_DATE,
    'Sales Rep',
    COALESCE(v_profile.tenant_id, '00000000-0000-0000-0000-000000000001'::uuid),
    true
  )
  RETURNING id INTO v_emp_id;

  RETURN v_emp_id;
END;
$$;
