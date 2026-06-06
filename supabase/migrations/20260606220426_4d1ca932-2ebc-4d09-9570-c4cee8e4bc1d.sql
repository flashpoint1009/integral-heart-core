
CREATE TABLE public.landing_pricing_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tagline TEXT,
  price_egp NUMERIC NOT NULL DEFAULT 0,
  price_label TEXT,
  period TEXT NOT NULL DEFAULT 'شهرياً',
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  cta_label TEXT DEFAULT 'ابدأ الآن',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.landing_pricing_plans TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.landing_pricing_plans TO authenticated;
GRANT ALL ON public.landing_pricing_plans TO service_role;

ALTER TABLE public.landing_pricing_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active plans are public" ON public.landing_pricing_plans
  FOR SELECT USING (is_active = true OR public.is_developer(auth.uid()) OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Developers/admins manage plans" ON public.landing_pricing_plans
  FOR ALL TO authenticated
  USING (public.is_developer(auth.uid()) OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.is_developer(auth.uid()) OR public.has_role(auth.uid(),'admin'));

CREATE TRIGGER landing_pricing_plans_updated_at
  BEFORE UPDATE ON public.landing_pricing_plans
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

INSERT INTO public.landing_pricing_plans (name, tagline, price_egp, price_label, period, features, is_featured, sort_order, cta_label) VALUES
('البداية', 'للأعمال الصغيرة والمشاريع الناشئة', 0, NULL, 'مجاناً للأبد',
  '["مستخدم واحد","حتى 100 فاتورة شهرياً","إدارة مخزون أساسية","نقطة بيع POS واحدة","دعم بالبريد الإلكتروني"]'::jsonb,
  false, 1, 'ابدأ مجاناً'),
('الاحترافي', 'الأكثر اختياراً من شركاتنا', 999, NULL, 'شهرياً',
  '["حتى 10 مستخدمين","فواتير غير محدودة","مخزون متعدد المستودعات","نقاط بيع متعددة","إدارة مندوبين ميداني","تقارير وذكاء أعمال","دعم أولوية على الواتساب"]'::jsonb,
  true, 2, 'ابدأ تجربتك المجانية'),
('المؤسسات', 'للشركات الكبرى والسلاسل', 0, 'حسب الطلب', '',
  '["مستخدمون غير محدود","فروع غير محدودة","تخصيص كامل للوحدات","API كامل وتكامل خارجي","مدير حساب مخصص","SLA 99.99%","تدريب وتأهيل الفريق"]'::jsonb,
  false, 3, 'تواصل معنا');
