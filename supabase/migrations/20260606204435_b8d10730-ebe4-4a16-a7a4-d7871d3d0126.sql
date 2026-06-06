CREATE TABLE IF NOT EXISTS public.site_config (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  site_name text NOT NULL DEFAULT 'My Store',
  logo_url text,
  primary_color text NOT NULL DEFAULT '#1e3a8a',
  card_shape text NOT NULL DEFAULT 'square',
  contact_phone text,
  contact_address text,
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_published boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_config TO authenticated;
GRANT SELECT ON public.site_config TO anon;
GRANT ALL ON public.site_config TO service_role;
ALTER TABLE public.site_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "site_config_public_read" ON public.site_config FOR SELECT USING (true);
CREATE POLICY "site_config_write" ON public.site_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE TRIGGER site_config_updated BEFORE UPDATE ON public.site_config
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

CREATE TABLE IF NOT EXISTS public.online_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_number text NOT NULL,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  customer_address text NOT NULL,
  customer_notes text,
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  payment_method text NOT NULL DEFAULT 'cod',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.online_orders TO authenticated;
GRANT ALL ON public.online_orders TO service_role;
ALTER TABLE public.online_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "online_orders_auth_read" ON public.online_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "online_orders_auth_write" ON public.online_orders FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'cashier'))
  WITH CHECK (true);
CREATE TRIGGER online_orders_updated BEFORE UPDATE ON public.online_orders
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

CREATE TABLE IF NOT EXISTS public.online_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.online_orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  product_name text NOT NULL,
  qty numeric(14,3) NOT NULL,
  unit_price numeric(14,2) NOT NULL,
  total numeric(14,2) NOT NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.online_order_items TO authenticated;
GRANT ALL ON public.online_order_items TO service_role;
ALTER TABLE public.online_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "online_order_items_auth_read" ON public.online_order_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "online_order_items_auth_write" ON public.online_order_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.site_config (tenant_id, site_name, sections)
VALUES ('00000000-0000-0000-0000-000000000001'::uuid, 'متجري', '[]'::jsonb)
ON CONFLICT (tenant_id) DO NOTHING;