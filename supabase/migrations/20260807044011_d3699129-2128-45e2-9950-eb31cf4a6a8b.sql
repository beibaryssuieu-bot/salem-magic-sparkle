CREATE TABLE public.class_quality (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  period date NOT NULL,
  scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, period)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_quality TO authenticated;
GRANT ALL ON public.class_quality TO service_role;

ALTER TABLE public.class_quality ENABLE ROW LEVEL SECURITY;

CREATE POLICY class_quality_select_auth ON public.class_quality
  FOR SELECT TO authenticated USING (true);

CREATE POLICY class_quality_admin_write ON public.class_quality
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_class_quality_updated_at
  BEFORE UPDATE ON public.class_quality
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP POLICY IF EXISTS attendance_insert_own ON public.attendance;
CREATE POLICY attendance_insert_own ON public.attendance
  FOR INSERT TO authenticated
  WITH CHECK (
    (user_id = auth.uid() AND day = CURRENT_DATE)
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS attendance_update_own_or_admin ON public.attendance;
CREATE POLICY attendance_update_own_or_admin ON public.attendance
  FOR UPDATE TO authenticated
  USING ((user_id = auth.uid() AND day = CURRENT_DATE) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK ((user_id = auth.uid() AND day = CURRENT_DATE) OR public.has_role(auth.uid(), 'admin'));