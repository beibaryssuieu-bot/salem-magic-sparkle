CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  assigned_role public.app_role;
BEGIN
  INSERT INTO public.profiles (id, username, full_name, class_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email,'@',1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name',''),
    NULLIF(NEW.raw_user_meta_data->>'class_name','')
  )
  ON CONFLICT (id) DO NOTHING;

  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    assigned_role := 'teacher';
  ELSE
    assigned_role := 'admin';
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, assigned_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;