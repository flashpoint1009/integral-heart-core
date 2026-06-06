
-- Customers: assigned rep + GPS
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS assigned_rep_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lat NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS lng NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS address_notes TEXT;

-- Employees: supervisor link
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS assigned_supervisor_id UUID REFERENCES public.employees(id) ON DELETE SET NULL;

-- Sales invoices: rep + visit link
ALTER TABLE public.sales_invoices
  ADD COLUMN IF NOT EXISTS rep_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS visit_id UUID;

-- Helper: get employee id of current user
CREATE OR REPLACE FUNCTION public.current_employee_id()
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.employees WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Rep check-ins (attendance with GPS)
CREATE TABLE IF NOT EXISTS public.rep_check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  check_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  check_out_at TIMESTAMPTZ,
  check_in_lat NUMERIC(10,7),
  check_in_lng NUMERIC(10,7),
  check_out_lat NUMERIC(10,7),
  check_out_lng NUMERIC(10,7),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rep_check_ins TO authenticated;
GRANT ALL ON public.rep_check_ins TO service_role;
ALTER TABLE public.rep_check_ins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rep_check_ins_own_or_admin_select" ON public.rep_check_ins FOR SELECT TO authenticated
  USING (employee_id = public.current_employee_id() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'supervisor'));
CREATE POLICY "rep_check_ins_own_insert" ON public.rep_check_ins FOR INSERT TO authenticated
  WITH CHECK (employee_id = public.current_employee_id() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE POLICY "rep_check_ins_own_update" ON public.rep_check_ins FOR UPDATE TO authenticated
  USING (employee_id = public.current_employee_id() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE POLICY "rep_check_ins_admin_delete" ON public.rep_check_ins FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

-- Rep visits
CREATE TABLE IF NOT EXISTS public.rep_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  lat NUMERIC(10,7),
  lng NUMERIC(10,7),
  outcome TEXT NOT NULL DEFAULT 'pending' CHECK (outcome IN ('pending','sold','collected','no_sale','not_found','rescheduled')),
  notes TEXT,
  invoice_id UUID REFERENCES public.sales_invoices(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rep_visits_employee_date ON public.rep_visits(employee_id, started_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rep_visits TO authenticated;
GRANT ALL ON public.rep_visits TO service_role;
ALTER TABLE public.rep_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rep_visits_own_or_admin_select" ON public.rep_visits FOR SELECT TO authenticated
  USING (employee_id = public.current_employee_id() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'supervisor'));
CREATE POLICY "rep_visits_own_insert" ON public.rep_visits FOR INSERT TO authenticated
  WITH CHECK (employee_id = public.current_employee_id() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE POLICY "rep_visits_own_update" ON public.rep_visits FOR UPDATE TO authenticated
  USING (employee_id = public.current_employee_id() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE POLICY "rep_visits_admin_delete" ON public.rep_visits FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

-- Rep routes (planned visits)
CREATE TABLE IF NOT EXISTS public.rep_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  route_date DATE NOT NULL,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  sequence INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done','skipped')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, route_date, customer_id)
);
CREATE INDEX IF NOT EXISTS idx_rep_routes_emp_date ON public.rep_routes(employee_id, route_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rep_routes TO authenticated;
GRANT ALL ON public.rep_routes TO service_role;
ALTER TABLE public.rep_routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rep_routes_own_or_admin_select" ON public.rep_routes FOR SELECT TO authenticated
  USING (employee_id = public.current_employee_id() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'supervisor'));
CREATE POLICY "rep_routes_admin_insert" ON public.rep_routes FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'supervisor'));
CREATE POLICY "rep_routes_own_or_admin_update" ON public.rep_routes FOR UPDATE TO authenticated
  USING (employee_id = public.current_employee_id() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'supervisor'));
CREATE POLICY "rep_routes_admin_delete" ON public.rep_routes FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'supervisor'));

-- Trigger: when a rep checks in, also create attendance "present" for today
CREATE OR REPLACE FUNCTION public.tg_rep_checkin_attendance()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.attendance (employee_id, date, status, check_in, notes)
  VALUES (NEW.employee_id, NEW.check_in_at::date, 'present', NEW.check_in_at::time, 'rep check-in')
  ON CONFLICT (employee_id, date) DO UPDATE
    SET status = 'present', check_in = COALESCE(public.attendance.check_in, EXCLUDED.check_in);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_rep_checkin_attendance ON public.rep_check_ins;
CREATE TRIGGER trg_rep_checkin_attendance
  AFTER INSERT ON public.rep_check_ins
  FOR EACH ROW EXECUTE FUNCTION public.tg_rep_checkin_attendance();
