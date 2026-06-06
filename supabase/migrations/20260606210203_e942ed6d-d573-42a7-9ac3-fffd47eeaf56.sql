
-- Extend site_config with theme, banners, nav, search/menu toggles, custom domain
ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS theme_preset TEXT DEFAULT 'modern',
  ADD COLUMN IF NOT EXISTS enable_search BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS enable_menu BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS nav_items JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS banners JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS custom_domain TEXT,
  ADD COLUMN IF NOT EXISTS hero_image TEXT,
  ADD COLUMN IF NOT EXISTS secondary_color TEXT;

-- RLS for store-images bucket: authenticated users can upload/manage; anyone authenticated can read
CREATE POLICY "Authenticated can upload store-images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'store-images');

CREATE POLICY "Authenticated can update store-images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'store-images');

CREATE POLICY "Authenticated can delete store-images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'store-images');

CREATE POLICY "Authenticated can read store-images"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'store-images');
