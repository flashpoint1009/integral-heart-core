
-- 1) Source tracking on journal entries
ALTER TABLE public.journal_entries
  ADD COLUMN IF NOT EXISTS source_type TEXT,
  ADD COLUMN IF NOT EXISTS source_id UUID;
CREATE UNIQUE INDEX IF NOT EXISTS uq_journal_source ON public.journal_entries(source_type, source_id) WHERE source_type IS NOT NULL;

-- 2) Helper: map an `accounts` row (cash/bank) to a chart_accounts id
CREATE OR REPLACE FUNCTION public.cash_or_bank_chart_id(_account_id UUID)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT ca.id FROM public.accounts a
  JOIN public.chart_accounts ca ON ca.code = CASE WHEN a.type = 'bank' THEN '1200' ELSE '1100' END
  WHERE a.id = _account_id LIMIT 1;
$$;

-- 3) Helper: post a balanced journal entry with two lines
CREATE OR REPLACE FUNCTION public.post_journal_auto(
  _date TIMESTAMPTZ, _ref TEXT, _desc TEXT, _amount NUMERIC,
  _debit_account UUID, _credit_account UUID,
  _source_type TEXT, _source_id UUID, _created_by UUID
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_entry_id UUID; v_num INT;
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN RETURN NULL; END IF;
  IF _debit_account IS NULL OR _credit_account IS NULL THEN RETURN NULL; END IF;

  SELECT COALESCE(MAX(entry_number), 0) + 1 INTO v_num FROM public.journal_entries;

  INSERT INTO public.journal_entries (entry_number, entry_date, reference, description, total_debit, total_credit, created_by, source_type, source_id)
  VALUES (v_num, _date, _ref, _desc, _amount, _amount, _created_by, _source_type, _source_id)
  RETURNING id INTO v_entry_id;

  INSERT INTO public.journal_entry_lines (entry_id, account_id, debit, credit, description) VALUES
    (v_entry_id, _debit_account, _amount, 0, _desc),
    (v_entry_id, _credit_account, 0, _amount, _desc);

  RETURN v_entry_id;
END $$;

-- 4) Delete linked journal when source row deleted
CREATE OR REPLACE FUNCTION public.tg_delete_linked_journal()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.journal_entries WHERE source_type = TG_ARGV[0] AND source_id = OLD.id;
  RETURN OLD;
END $$;

-- 5) Trigger functions per source

-- Expense
CREATE OR REPLACE FUNCTION public.tg_expense_journal()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_dr UUID; v_cr UUID;
BEGIN
  SELECT id INTO v_dr FROM public.chart_accounts WHERE code = '5000';
  v_cr := public.cash_or_bank_chart_id(NEW.account_id);
  PERFORM public.post_journal_auto(NEW.expense_date, NEW.reference, COALESCE('Expense: '||NEW.vendor, 'Expense'),
    NEW.amount, v_dr, v_cr, 'expense', NEW.id, NEW.created_by);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS expense_journal_ins ON public.expenses;
CREATE TRIGGER expense_journal_ins AFTER INSERT ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.tg_expense_journal();
DROP TRIGGER IF EXISTS expense_journal_del ON public.expenses;
CREATE TRIGGER expense_journal_del BEFORE DELETE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.tg_delete_linked_journal('expense');

-- Account transfer
CREATE OR REPLACE FUNCTION public.tg_transfer_journal()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_dr UUID; v_cr UUID;
BEGIN
  v_dr := public.cash_or_bank_chart_id(NEW.to_account_id);
  v_cr := public.cash_or_bank_chart_id(NEW.from_account_id);
  PERFORM public.post_journal_auto(NEW.transfer_date, NULL, 'Transfer between accounts',
    NEW.amount, v_dr, v_cr, 'transfer', NEW.id, NEW.created_by);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS transfer_journal_ins ON public.account_transfers;
CREATE TRIGGER transfer_journal_ins AFTER INSERT ON public.account_transfers FOR EACH ROW EXECUTE FUNCTION public.tg_transfer_journal();
DROP TRIGGER IF EXISTS transfer_journal_del ON public.account_transfers;
CREATE TRIGGER transfer_journal_del BEFORE DELETE ON public.account_transfers FOR EACH ROW EXECUTE FUNCTION public.tg_delete_linked_journal('transfer');

-- Customer payment: DR cash/bank, CR customers (1300)
CREATE OR REPLACE FUNCTION public.tg_cust_payment_journal()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_dr UUID; v_cr UUID;
BEGIN
  v_dr := public.cash_or_bank_chart_id(NEW.account_id);
  SELECT id INTO v_cr FROM public.chart_accounts WHERE code = '1300';
  PERFORM public.post_journal_auto(NEW.payment_date, NEW.reference, 'Customer payment',
    NEW.amount, v_dr, v_cr, 'customer_payment', NEW.id, NEW.created_by);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS cust_payment_journal_ins ON public.customer_payments;
CREATE TRIGGER cust_payment_journal_ins AFTER INSERT ON public.customer_payments FOR EACH ROW EXECUTE FUNCTION public.tg_cust_payment_journal();
DROP TRIGGER IF EXISTS cust_payment_journal_del ON public.customer_payments;
CREATE TRIGGER cust_payment_journal_del BEFORE DELETE ON public.customer_payments FOR EACH ROW EXECUTE FUNCTION public.tg_delete_linked_journal('customer_payment');

-- Supplier payment: DR suppliers (2100), CR cash/bank
CREATE OR REPLACE FUNCTION public.tg_sup_payment_journal()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_dr UUID; v_cr UUID;
BEGIN
  SELECT id INTO v_dr FROM public.chart_accounts WHERE code = '2100';
  v_cr := public.cash_or_bank_chart_id(NEW.account_id);
  PERFORM public.post_journal_auto(NEW.payment_date, NEW.reference, 'Supplier payment',
    NEW.amount, v_dr, v_cr, 'supplier_payment', NEW.id, NEW.created_by);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS sup_payment_journal_ins ON public.supplier_payments;
CREATE TRIGGER sup_payment_journal_ins AFTER INSERT ON public.supplier_payments FOR EACH ROW EXECUTE FUNCTION public.tg_sup_payment_journal();
DROP TRIGGER IF EXISTS sup_payment_journal_del ON public.supplier_payments;
CREATE TRIGGER sup_payment_journal_del BEFORE DELETE ON public.supplier_payments FOR EACH ROW EXECUTE FUNCTION public.tg_delete_linked_journal('supplier_payment');

-- Sales invoice: DR customers (1300), CR sales income (4100)
CREATE OR REPLACE FUNCTION public.tg_sales_invoice_journal()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_dr UUID; v_cr UUID;
BEGIN
  IF COALESCE(NEW.status,'draft') = 'draft' THEN RETURN NEW; END IF;
  SELECT id INTO v_dr FROM public.chart_accounts WHERE code = '1300';
  SELECT id INTO v_cr FROM public.chart_accounts WHERE code = '4100';
  PERFORM public.post_journal_auto(NEW.invoice_date, NEW.invoice_number, 'Sales invoice '||COALESCE(NEW.invoice_number,''),
    NEW.total, v_dr, v_cr, 'sales_invoice', NEW.id, NEW.created_by);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS sales_invoice_journal_ins ON public.sales_invoices;
CREATE TRIGGER sales_invoice_journal_ins AFTER INSERT ON public.sales_invoices FOR EACH ROW EXECUTE FUNCTION public.tg_sales_invoice_journal();
DROP TRIGGER IF EXISTS sales_invoice_journal_del ON public.sales_invoices;
CREATE TRIGGER sales_invoice_journal_del BEFORE DELETE ON public.sales_invoices FOR EACH ROW EXECUTE FUNCTION public.tg_delete_linked_journal('sales_invoice');

-- Payroll: when approved, DR salaries (5200), CR cash (1100)
CREATE OR REPLACE FUNCTION public.tg_payroll_journal()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_dr UUID; v_cr UUID;
BEGIN
  IF NEW.status NOT IN ('approved','paid') THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IN ('approved','paid') THEN RETURN NEW; END IF;
  SELECT id INTO v_dr FROM public.chart_accounts WHERE code = '5200';
  SELECT id INTO v_cr FROM public.chart_accounts WHERE code = '1100';
  PERFORM public.post_journal_auto(NEW.period_month::TIMESTAMPTZ, NULL, 'Payroll run '||to_char(NEW.period_month,'YYYY-MM'),
    NEW.total_net, v_dr, v_cr, 'payroll', NEW.id, NEW.created_by);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payroll_journal ON public.payroll_runs;
CREATE TRIGGER payroll_journal AFTER INSERT OR UPDATE OF status ON public.payroll_runs FOR EACH ROW EXECUTE FUNCTION public.tg_payroll_journal();
DROP TRIGGER IF EXISTS payroll_journal_del ON public.payroll_runs;
CREATE TRIGGER payroll_journal_del BEFORE DELETE ON public.payroll_runs FOR EACH ROW EXECUTE FUNCTION public.tg_delete_linked_journal('payroll');

-- 6) Trial balance view
CREATE OR REPLACE VIEW public.v_trial_balance AS
SELECT
  ca.id AS account_id, ca.code, ca.name_ar, ca.name_en, ca.type,
  COALESCE(SUM(jl.debit), 0)  AS total_debit,
  COALESCE(SUM(jl.credit), 0) AS total_credit,
  COALESCE(SUM(jl.debit - jl.credit), 0) AS balance
FROM public.chart_accounts ca
LEFT JOIN public.journal_entry_lines jl ON jl.account_id = ca.id
WHERE ca.is_active = TRUE
GROUP BY ca.id, ca.code, ca.name_ar, ca.name_en, ca.type
ORDER BY ca.code;
GRANT SELECT ON public.v_trial_balance TO authenticated, service_role;
