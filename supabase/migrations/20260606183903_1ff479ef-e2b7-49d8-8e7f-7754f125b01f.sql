
-- 1) Employees: leave balances + insurance percentages
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS annual_leave_balance NUMERIC(6,2) NOT NULL DEFAULT 21,
  ADD COLUMN IF NOT EXISTS casual_leave_balance NUMERIC(6,2) NOT NULL DEFAULT 6,
  ADD COLUMN IF NOT EXISTS sick_leave_balance NUMERIC(6,2) NOT NULL DEFAULT 90,
  ADD COLUMN IF NOT EXISTS insurance_employee_pct NUMERIC(5,2) NOT NULL DEFAULT 11,
  ADD COLUMN IF NOT EXISTS insurance_employer_pct NUMERIC(5,2) NOT NULL DEFAULT 18.75,
  ADD COLUMN IF NOT EXISTS transport_allowance NUMERIC(14,2) NOT NULL DEFAULT 0;

-- 2) Allow "casual" leave_type
ALTER TABLE public.leave_requests DROP CONSTRAINT IF EXISTS leave_requests_leave_type_check;
ALTER TABLE public.leave_requests
  ADD CONSTRAINT leave_requests_leave_type_check
  CHECK (leave_type = ANY (ARRAY['annual','casual','sick','unpaid','other']));

-- 3) Penalties table (reason is required)
CREATE TABLE IF NOT EXISTS public.penalties (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  amount      NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  reason      TEXT NOT NULL CHECK (length(btrim(reason)) > 0),
  notes       TEXT,
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.penalties TO authenticated;
GRANT ALL ON public.penalties TO service_role;
ALTER TABLE public.penalties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pen_read" ON public.penalties FOR SELECT TO authenticated USING (true);
CREATE POLICY "pen_write" ON public.penalties FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4) Salary advances
CREATE TABLE IF NOT EXISTS public.salary_advances (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  request_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  amount          NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  installments    INT NOT NULL DEFAULT 1 CHECK (installments > 0),
  monthly_deduction NUMERIC(14,2) NOT NULL DEFAULT 0,
  remaining       NUMERIC(14,2) NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','approved','rejected','paid_off')),
  reason          TEXT,
  reviewed_by     UUID REFERENCES auth.users(id),
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.salary_advances TO authenticated;
GRANT ALL ON public.salary_advances TO service_role;
ALTER TABLE public.salary_advances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sa_read" ON public.salary_advances FOR SELECT TO authenticated USING (true);
CREATE POLICY "sa_write" ON public.salary_advances FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5) payroll_items: extra components
ALTER TABLE public.payroll_items
  ADD COLUMN IF NOT EXISTS transport_allowance NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS incentives NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS insurance NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS penalties_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS advance_deduction NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS absence_days INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS absence_deduction NUMERIC(14,2) NOT NULL DEFAULT 0;

-- 6) Function: auto-mark absences for one day
CREATE OR REPLACE FUNCTION public.mark_auto_absent(p_date DATE DEFAULT CURRENT_DATE)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count INT;
BEGIN
  WITH ins AS (
    INSERT INTO public.attendance (employee_id, date, status, notes)
    SELECT e.id, p_date, 'absent', 'auto'
    FROM public.employees e
    WHERE e.is_active = true
      AND NOT EXISTS (
        SELECT 1 FROM public.attendance a
        WHERE a.employee_id = e.id AND a.date = p_date
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.leave_requests lr
        WHERE lr.employee_id = e.id
          AND lr.status = 'approved'
          AND p_date BETWEEN lr.from_date AND lr.to_date
      )
    RETURNING 1
  )
  SELECT count(*) INTO inserted_count FROM ins;
  RETURN COALESCE(inserted_count, 0);
END;
$$;

-- 7) Trigger: when a leave is approved -> mark attendance + decrement balance
CREATE OR REPLACE FUNCTION public.handle_leave_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d DATE;
  was_approved BOOLEAN := (TG_OP = 'UPDATE' AND OLD.status = 'approved');
  is_approved  BOOLEAN := (NEW.status = 'approved');
BEGIN
  -- Approving for the first time (or re-approving)
  IF is_approved AND NOT was_approved THEN
    -- Upsert attendance as "leave" for each day in range
    d := NEW.from_date;
    WHILE d <= NEW.to_date LOOP
      INSERT INTO public.attendance (employee_id, date, status, notes)
      VALUES (NEW.employee_id, d, 'leave', 'leave: ' || NEW.leave_type)
      ON CONFLICT (employee_id, date)
      DO UPDATE SET status = 'leave', notes = 'leave: ' || NEW.leave_type;
      d := d + INTERVAL '1 day';
    END LOOP;
    -- Decrement balance
    IF NEW.leave_type = 'annual' THEN
      UPDATE public.employees SET annual_leave_balance = annual_leave_balance - NEW.days WHERE id = NEW.employee_id;
    ELSIF NEW.leave_type = 'casual' THEN
      UPDATE public.employees SET casual_leave_balance = casual_leave_balance - NEW.days WHERE id = NEW.employee_id;
    ELSIF NEW.leave_type = 'sick' THEN
      UPDATE public.employees SET sick_leave_balance = sick_leave_balance - NEW.days WHERE id = NEW.employee_id;
    END IF;
  END IF;

  -- Reverting approval (rejected / pending after being approved)
  IF was_approved AND NOT is_approved THEN
    DELETE FROM public.attendance
      WHERE employee_id = NEW.employee_id
        AND date BETWEEN NEW.from_date AND NEW.to_date
        AND status = 'leave';
    IF OLD.leave_type = 'annual' THEN
      UPDATE public.employees SET annual_leave_balance = annual_leave_balance + OLD.days WHERE id = OLD.employee_id;
    ELSIF OLD.leave_type = 'casual' THEN
      UPDATE public.employees SET casual_leave_balance = casual_leave_balance + OLD.days WHERE id = OLD.employee_id;
    ELSIF OLD.leave_type = 'sick' THEN
      UPDATE public.employees SET sick_leave_balance = sick_leave_balance + OLD.days WHERE id = OLD.employee_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_leave_status ON public.leave_requests;
CREATE TRIGGER trg_leave_status
  AFTER INSERT OR UPDATE OF status ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_leave_status_change();

-- 8) When an approved leave is deleted, restore balance + clean attendance
CREATE OR REPLACE FUNCTION public.handle_leave_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'approved' THEN
    DELETE FROM public.attendance
      WHERE employee_id = OLD.employee_id
        AND date BETWEEN OLD.from_date AND OLD.to_date
        AND status = 'leave';
    IF OLD.leave_type = 'annual' THEN
      UPDATE public.employees SET annual_leave_balance = annual_leave_balance + OLD.days WHERE id = OLD.employee_id;
    ELSIF OLD.leave_type = 'casual' THEN
      UPDATE public.employees SET casual_leave_balance = casual_leave_balance + OLD.days WHERE id = OLD.employee_id;
    ELSIF OLD.leave_type = 'sick' THEN
      UPDATE public.employees SET sick_leave_balance = sick_leave_balance + OLD.days WHERE id = OLD.employee_id;
    END IF;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_leave_delete ON public.leave_requests;
CREATE TRIGGER trg_leave_delete
  BEFORE DELETE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_leave_delete();
