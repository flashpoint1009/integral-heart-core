CREATE TABLE public.user_screen_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  screen_key TEXT NOT NULL,
  allowed BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, screen_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_screen_permissions TO authenticated;
GRANT ALL ON public.user_screen_permissions TO service_role;

ALTER TABLE public.user_screen_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usp_read_self_or_admin" ON public.user_screen_permissions
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_developer(auth.uid())
  OR (
    tenant_id = public.current_tenant_id()
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  )
);

CREATE POLICY "usp_write_admin" ON public.user_screen_permissions
FOR ALL TO authenticated
USING (
  public.is_developer(auth.uid())
  OR (
    tenant_id = public.current_tenant_id()
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  )
)
WITH CHECK (
  public.is_developer(auth.uid())
  OR (
    tenant_id = public.current_tenant_id()
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  )
);

CREATE TRIGGER trg_usp_updated_at BEFORE UPDATE ON public.user_screen_permissions
FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

CREATE OR REPLACE FUNCTION public.screen_allowed(_user_id UUID, _screen_key TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT allowed FROM public.user_screen_permissions
     WHERE user_id = _user_id AND screen_key = _screen_key
     LIMIT 1),
    true
  )
$$;