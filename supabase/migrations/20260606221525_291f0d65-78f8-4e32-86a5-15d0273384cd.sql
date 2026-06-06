
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_count INT;
  default_tenant UUID := '00000000-0000-0000-0000-000000000001';
  v_name TEXT;
BEGIN
  v_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email);

  INSERT INTO public.profiles (id, email, full_name, tenant_id)
  VALUES (NEW.id, NEW.email, v_name, default_tenant);

  SELECT COUNT(*) INTO user_count FROM auth.users;

  IF user_count = 1 THEN
    -- First ever user becomes admin
    INSERT INTO public.user_roles (user_id, role, tenant_id)
    VALUES (NEW.id, 'admin', default_tenant);
  ELSE
    -- New users get NO role. Notify admin + developer to assign permissions.
    PERFORM public.notify_role(
      'admin','user_pending_approval',
      'مستخدم جديد بانتظار الصلاحيات',
      COALESCE(v_name,'مستخدم') || ' (' || NEW.email || ') سجّل دخول ويحتاج تحديد صلاحياته.',
      '/permissions',
      jsonb_build_object('user_id', NEW.id, 'email', NEW.email)
    );
    PERFORM public.notify_role(
      'developer','user_pending_approval',
      'مستخدم جديد بانتظار الصلاحيات',
      COALESCE(v_name,'مستخدم') || ' (' || NEW.email || ') يحتاج تحديد صلاحياته.',
      '/permissions',
      jsonb_build_object('user_id', NEW.id, 'email', NEW.email)
    );
  END IF;

  RETURN NEW;
END;
$function$;
