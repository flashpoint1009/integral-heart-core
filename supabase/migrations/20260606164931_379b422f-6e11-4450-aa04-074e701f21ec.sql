
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'cashier', 'accountant');
CREATE TYPE public.movement_type AS ENUM ('purchase', 'sale', 'transfer', 'adjustment', 'return');
CREATE TYPE public.invoice_status AS ENUM ('draft', 'confirmed', 'paid', 'partial', 'cancelled');
CREATE TYPE public.payment_kind AS ENUM ('cash', 'card', 'bank', 'credit', 'other');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  avatar_url TEXT,
  locale TEXT NOT NULL DEFAULT 'ar',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "roles_select_own" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "roles_admin_all" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ AUTO-CREATE PROFILE + FIRST USER = ADMIN ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE user_count INT;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));

  SELECT COUNT(*) INTO user_count FROM auth.users;
  IF user_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'cashier');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ UPDATED_AT HELPER ============
CREATE OR REPLACE FUNCTION public.tg_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- ============ CATEGORIES ============
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar TEXT NOT NULL,
  name_en TEXT,
  parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cats_read" ON public.categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "cats_write" ON public.categories FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE TRIGGER cats_updated BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- ============ PRODUCTS ============
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT UNIQUE,
  barcode TEXT,
  name_ar TEXT NOT NULL,
  name_en TEXT,
  description TEXT,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  unit TEXT DEFAULT 'piece',
  cost_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  sale_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  image_url TEXT,
  min_stock NUMERIC(14,3) DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  custom_fields JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_products_barcode ON public.products(barcode);
CREATE INDEX idx_products_category ON public.products(category_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prod_read" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "prod_write" ON public.products FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE TRIGGER prod_updated BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- ============ WAREHOUSES ============
CREATE TABLE public.warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  address TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.warehouses TO authenticated;
GRANT ALL ON public.warehouses TO service_role;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wh_read" ON public.warehouses FOR SELECT TO authenticated USING (true);
CREATE POLICY "wh_write" ON public.warehouses FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE TRIGGER wh_updated BEFORE UPDATE ON public.warehouses FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- ============ INVENTORY ============
CREATE TABLE public.inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  quantity NUMERIC(14,3) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(product_id, warehouse_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory TO authenticated;
GRANT ALL ON public.inventory TO service_role;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inv_read" ON public.inventory FOR SELECT TO authenticated USING (true);
CREATE POLICY "inv_write" ON public.inventory FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ STOCK MOVEMENTS ============
CREATE TABLE public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  movement_type public.movement_type NOT NULL,
  quantity NUMERIC(14,3) NOT NULL,
  unit_cost NUMERIC(14,2),
  reference_type TEXT,
  reference_id UUID,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sm_product ON public.stock_movements(product_id);
CREATE INDEX idx_sm_wh ON public.stock_movements(warehouse_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sm_read" ON public.stock_movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "sm_insert" ON public.stock_movements FOR INSERT TO authenticated WITH CHECK (true);

-- ============ CUSTOMERS ============
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  tax_number TEXT,
  credit_limit NUMERIC(14,2) DEFAULT 0,
  balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  notes TEXT,
  custom_fields JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cust_read" ON public.customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "cust_write" ON public.customers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER cust_updated BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- ============ SUPPLIERS ============
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  tax_number TEXT,
  balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sup_read" ON public.suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "sup_write" ON public.suppliers FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'accountant')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'accountant'));
CREATE TRIGGER sup_updated BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- ============ PAYMENT METHODS ============
CREATE TABLE public.payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  kind public.payment_kind NOT NULL DEFAULT 'cash',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_methods TO authenticated;
GRANT ALL ON public.payment_methods TO service_role;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pm_read" ON public.payment_methods FOR SELECT TO authenticated USING (true);
CREATE POLICY "pm_write" ON public.payment_methods FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

-- ============ SALES INVOICES ============
CREATE TABLE public.sales_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT UNIQUE NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
  invoice_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  paid NUMERIC(14,2) NOT NULL DEFAULT 0,
  status public.invoice_status NOT NULL DEFAULT 'draft',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_si_date ON public.sales_invoices(invoice_date DESC);
CREATE INDEX idx_si_customer ON public.sales_invoices(customer_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_invoices TO authenticated;
GRANT ALL ON public.sales_invoices TO service_role;
ALTER TABLE public.sales_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "si_read" ON public.sales_invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "si_write" ON public.sales_invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER si_updated BEFORE UPDATE ON public.sales_invoices FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- ============ SALES INVOICE ITEMS ============
CREATE TABLE public.sales_invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.sales_invoices(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity NUMERIC(14,3) NOT NULL,
  unit_price NUMERIC(14,2) NOT NULL,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  discount NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL
);
CREATE INDEX idx_sii_invoice ON public.sales_invoice_items(invoice_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_invoice_items TO authenticated;
GRANT ALL ON public.sales_invoice_items TO service_role;
ALTER TABLE public.sales_invoice_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sii_read" ON public.sales_invoice_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "sii_write" ON public.sales_invoice_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ PAYMENTS ============
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES public.sales_invoices(id) ON DELETE CASCADE,
  payment_method_id UUID REFERENCES public.payment_methods(id) ON DELETE SET NULL,
  amount NUMERIC(14,2) NOT NULL,
  payment_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pay_read" ON public.payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "pay_write" ON public.payments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ COMPANY SETTINGS ============
CREATE TABLE public.company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL DEFAULT 'My Company',
  logo_url TEXT,
  currency TEXT NOT NULL DEFAULT 'EGP',
  currency_symbol TEXT NOT NULL DEFAULT 'ج.م',
  default_tax_rate NUMERIC(5,2) NOT NULL DEFAULT 14,
  default_locale TEXT NOT NULL DEFAULT 'ar',
  address TEXT,
  phone TEXT,
  email TEXT,
  tax_number TEXT,
  extra JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_settings TO authenticated;
GRANT ALL ON public.company_settings TO service_role;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cs_read" ON public.company_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "cs_write" ON public.company_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ SEED DEFAULTS ============
INSERT INTO public.company_settings (company_name) VALUES ('شركتي');
INSERT INTO public.warehouses (name, code, is_default) VALUES ('المخزن الرئيسي', 'MAIN', true);
INSERT INTO public.payment_methods (name, kind) VALUES ('نقدي', 'cash'), ('شبكة', 'card'), ('آجل', 'credit');
