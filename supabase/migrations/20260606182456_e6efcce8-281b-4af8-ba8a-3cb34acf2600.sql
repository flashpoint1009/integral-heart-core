
-- =================== FINANCE ===================

-- Cash/Bank accounts
CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL DEFAULT 'cash',
  currency text NOT NULL DEFAULT 'EGP',
  opening_balance numeric(14,2) NOT NULL DEFAULT 0,
  balance numeric(14,2) NOT NULL DEFAULT 0,
  bank_name text,
  account_number text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts TO authenticated;
GRANT ALL ON public.accounts TO service_role;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "accounts_read" ON public.accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "accounts_write" ON public.accounts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_accounts_updated BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- Transfers between accounts
CREATE TABLE public.account_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  to_account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  transfer_date timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_transfers TO authenticated;
GRANT ALL ON public.account_transfers TO service_role;
ALTER TABLE public.account_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transfers_read" ON public.account_transfers FOR SELECT TO authenticated USING (true);
CREATE POLICY "transfers_write" ON public.account_transfers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Expense categories
CREATE TABLE public.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar text NOT NULL,
  name_en text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_categories TO authenticated;
GRANT ALL ON public.expense_categories TO service_role;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "expcat_read" ON public.expense_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "expcat_write" ON public.expense_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Expenses
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  expense_date timestamptz NOT NULL DEFAULT now(),
  vendor text,
  reference text,
  notes text,
  attachment_url text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exp_read" ON public.expenses FOR SELECT TO authenticated USING (true);
CREATE POLICY "exp_write" ON public.expenses FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_expenses_updated BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- Supplier payments (paid to suppliers, not tied to a specific purchase yet)
CREATE TABLE public.supplier_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  payment_date timestamptz NOT NULL DEFAULT now(),
  reference text,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_payments TO authenticated;
GRANT ALL ON public.supplier_payments TO service_role;
ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "spay_read" ON public.supplier_payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "spay_write" ON public.supplier_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Customer payments (received from customers, independent of invoice — for credits/advances)
CREATE TABLE public.customer_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  payment_date timestamptz NOT NULL DEFAULT now(),
  reference text,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_payments TO authenticated;
GRANT ALL ON public.customer_payments TO service_role;
ALTER TABLE public.customer_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cpay_read" ON public.customer_payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "cpay_write" ON public.customer_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Chart of accounts
CREATE TABLE public.chart_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name_ar text NOT NULL,
  name_en text,
  type text NOT NULL CHECK (type IN ('asset','liability','equity','income','expense')),
  parent_id uuid REFERENCES public.chart_accounts(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chart_accounts TO authenticated;
GRANT ALL ON public.chart_accounts TO service_role;
ALTER TABLE public.chart_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coa_read" ON public.chart_accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "coa_write" ON public.chart_accounts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Journal entries
CREATE TABLE public.journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_number serial NOT NULL,
  entry_date timestamptz NOT NULL DEFAULT now(),
  reference text,
  description text,
  total_debit numeric(14,2) NOT NULL DEFAULT 0,
  total_credit numeric(14,2) NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_entries TO authenticated;
GRANT ALL ON public.journal_entries TO service_role;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "je_read" ON public.journal_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "je_write" ON public.journal_entries FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.journal_entry_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.chart_accounts(id) ON DELETE RESTRICT,
  debit numeric(14,2) NOT NULL DEFAULT 0,
  credit numeric(14,2) NOT NULL DEFAULT 0,
  description text
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_entry_lines TO authenticated;
GRANT ALL ON public.journal_entry_lines TO service_role;
ALTER TABLE public.journal_entry_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "jel_read" ON public.journal_entry_lines FOR SELECT TO authenticated USING (true);
CREATE POLICY "jel_write" ON public.journal_entry_lines FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =================== HR ===================

CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_code text UNIQUE,
  full_name text NOT NULL,
  email text,
  phone text,
  national_id text,
  position text,
  department text,
  hire_date date,
  base_salary numeric(14,2) NOT NULL DEFAULT 0,
  allowances numeric(14,2) NOT NULL DEFAULT 0,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  address text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
GRANT ALL ON public.employees TO service_role;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "emp_read" ON public.employees FOR SELECT TO authenticated USING (true);
CREATE POLICY "emp_write" ON public.employees FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_employees_updated BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

CREATE TABLE public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  check_in timestamptz,
  check_out timestamptz,
  hours numeric(6,2),
  status text NOT NULL DEFAULT 'present' CHECK (status IN ('present','absent','leave','holiday')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "att_read" ON public.attendance FOR SELECT TO authenticated USING (true);
CREATE POLICY "att_write" ON public.attendance FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type text NOT NULL DEFAULT 'annual' CHECK (leave_type IN ('annual','sick','unpaid','other')),
  from_date date NOT NULL,
  to_date date NOT NULL,
  days int NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reason text,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_requests TO authenticated;
GRANT ALL ON public.leave_requests TO service_role;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lr_read" ON public.leave_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "lr_write" ON public.leave_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.payroll_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_month date NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','paid')),
  total_net numeric(14,2) NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (period_month)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_runs TO authenticated;
GRANT ALL ON public.payroll_runs TO service_role;
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pr_read" ON public.payroll_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "pr_write" ON public.payroll_runs FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.payroll_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  base_salary numeric(14,2) NOT NULL DEFAULT 0,
  allowances numeric(14,2) NOT NULL DEFAULT 0,
  bonuses numeric(14,2) NOT NULL DEFAULT 0,
  deductions numeric(14,2) NOT NULL DEFAULT 0,
  net_salary numeric(14,2) NOT NULL DEFAULT 0,
  paid boolean NOT NULL DEFAULT false,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_items TO authenticated;
GRANT ALL ON public.payroll_items TO service_role;
ALTER TABLE public.payroll_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pi_read" ON public.payroll_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "pi_write" ON public.payroll_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =================== SEED MINIMAL CHART OF ACCOUNTS ===================
INSERT INTO public.chart_accounts (code, name_ar, name_en, type) VALUES
  ('1000','الأصول','Assets','asset'),
  ('1100','الخزينة','Cash','asset'),
  ('1200','البنوك','Banks','asset'),
  ('1300','العملاء','Accounts Receivable','asset'),
  ('1400','المخزون','Inventory','asset'),
  ('2000','الالتزامات','Liabilities','liability'),
  ('2100','الموردين','Accounts Payable','liability'),
  ('3000','حقوق الملكية','Equity','equity'),
  ('4000','الإيرادات','Revenue','income'),
  ('4100','إيرادات المبيعات','Sales Revenue','income'),
  ('5000','المصروفات','Expenses','expense'),
  ('5100','تكلفة البضاعة المباعة','Cost of Goods Sold','expense'),
  ('5200','الرواتب','Salaries','expense'),
  ('5300','الإيجار','Rent','expense'),
  ('5400','المرافق','Utilities','expense')
ON CONFLICT (code) DO NOTHING;
