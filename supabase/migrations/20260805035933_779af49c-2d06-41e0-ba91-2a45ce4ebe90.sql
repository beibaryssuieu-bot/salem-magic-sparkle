CREATE TYPE public.app_role AS ENUM ('admin','teacher');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL UNIQUE,
  full_name text NOT NULL DEFAULT '',
  class_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'teacher',
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "profiles_select_own_or_admin" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_own_or_admin" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "user_roles_select_own_or_admin" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.classes TO authenticated;
GRANT ALL ON public.classes TO service_role;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "classes_select_auth" ON public.classes FOR SELECT TO authenticated USING (true);
CREATE POLICY "classes_admin_write" ON public.classes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.class_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  period date NOT NULL,
  discipline smallint NOT NULL DEFAULT 0,
  attendance smallint NOT NULL DEFAULT 0,
  reading smallint NOT NULL DEFAULT 0,
  volunteering smallint NOT NULL DEFAULT 0,
  psychology smallint NOT NULL DEFAULT 0,
  note text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, period)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_metrics TO authenticated;
GRANT ALL ON public.class_metrics TO service_role;
ALTER TABLE public.class_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "metrics_select_auth" ON public.class_metrics FOR SELECT TO authenticated USING (true);
CREATE POLICY "metrics_admin_write" ON public.class_metrics FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  event_date date NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events_select_auth" ON public.events FOR SELECT TO authenticated USING (true);
CREATE POLICY "events_admin_write" ON public.events FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name, class_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email,'@',1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name',''),
    NULLIF(NEW.raw_user_meta_data->>'class_name','')
  )
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id,'teacher')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

INSERT INTO public.classes (name) VALUES ('5 "А"'),('7 "А"'),('7 "Б"'),('8 "Б"'),('9 "А"');

INSERT INTO public.class_metrics (class_id, period, discipline, attendance, reading, volunteering, psychology, note)
SELECT c.id, DATE '2026-06-01',
  (ARRAY[89,93,78,84,91])[i], (ARRAY[93,88,95,90,86])[i], (ARRAY[61,74,58,80,69])[i],
  (ARRAY[84,70,66,92,77])[i], (ARRAY[76,81,64,88,72])[i], NULL
FROM (SELECT id, row_number() OVER (ORDER BY name) AS i FROM public.classes) c;

INSERT INTO public.class_metrics (class_id, period, discipline, attendance, reading, volunteering, psychology, note)
SELECT c.id, DATE '2026-07-01',
  (ARRAY[91,90,82,86,94])[i], (ARRAY[95,91,93,92,89])[i], (ARRAY[66,79,63,83,74])[i],
  (ARRAY[88,75,71,94,80])[i], (ARRAY[79,84,68,90,78])[i], NULL
FROM (SELECT id, row_number() OVER (ORDER BY name) AS i FROM public.classes) c;

INSERT INTO public.events (title, event_date, description) VALUES
  ('Таза Қазақстан экоакциясы', DATE '2026-08-12', 'Мектеп аумағын тазалау және экологиялық сабақ'),
  ('Құқық және тәртіп тәрбие сағаты', DATE '2026-08-18', 'Инспектормен кездесу'),
  ('Кітапхана күні акциясы', DATE '2026-08-25', 'Кітап оқу марафонының ашылуы');