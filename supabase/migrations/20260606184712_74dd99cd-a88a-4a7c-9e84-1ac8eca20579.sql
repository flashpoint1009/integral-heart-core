
CREATE TABLE public.bonuses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  period_month DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  bonus_type TEXT NOT NULL DEFAULT 'incentive',
  reason TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bonuses TO authenticated;
GRANT ALL ON public.bonuses TO service_role;
ALTER TABLE public.bonuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_bonuses" ON public.bonuses FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_write_bonuses" ON public.bonuses FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER bonuses_updated_at BEFORE UPDATE ON public.bonuses FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();
CREATE INDEX idx_bonuses_employee_period ON public.bonuses(employee_id, period_month);
