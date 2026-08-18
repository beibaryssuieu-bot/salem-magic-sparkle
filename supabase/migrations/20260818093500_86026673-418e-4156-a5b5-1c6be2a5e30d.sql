-- Іс-шараларға ҚМЖ (жоспар) және есеп тапсыру мүмкіндігін қосу.
-- Файлдар қолданыстағы "reports" storage bucket-інде сақталады
-- (жол құрылымы: {user_id}/... — бар RLS саясаттары соны қолдайды).

CREATE TABLE public.event_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_path text,
  file_name text,
  file_type text,
  link_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, class_id),
  CHECK (file_path IS NOT NULL OR link_url IS NOT NULL)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_plans TO authenticated;
GRANT ALL ON public.event_plans TO service_role;
ALTER TABLE public.event_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY event_plans_select_auth ON public.event_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY event_plans_insert_own ON public.event_plans FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY event_plans_update_own_or_admin ON public.event_plans FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY event_plans_delete_own_or_admin ON public.event_plans FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_event_plans_updated_at BEFORE UPDATE ON public.event_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.event_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, class_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_reports TO authenticated;
GRANT ALL ON public.event_reports TO service_role;
ALTER TABLE public.event_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY event_reports_select_auth ON public.event_reports FOR SELECT TO authenticated USING (true);
CREATE POLICY event_reports_insert_own ON public.event_reports FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY event_reports_update_own_or_admin ON public.event_reports FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY event_reports_delete_own_or_admin ON public.event_reports FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_event_reports_updated_at BEFORE UPDATE ON public.event_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Бір есепке бірнеше файл/сілтеме (фото, видео, құжат) тіркеу үшін.
CREATE TABLE public.event_report_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.event_reports(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('file', 'link')),
  file_path text,
  file_name text,
  file_type text,
  link_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (kind = 'file' AND file_path IS NOT NULL) OR
    (kind = 'link' AND link_url IS NOT NULL)
  )
);
GRANT SELECT, INSERT, DELETE ON public.event_report_attachments TO authenticated;
GRANT ALL ON public.event_report_attachments TO service_role;
ALTER TABLE public.event_report_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY event_report_attachments_select_auth ON public.event_report_attachments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY event_report_attachments_insert_own ON public.event_report_attachments
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.event_reports r WHERE r.id = report_id AND r.user_id = auth.uid())
  );
CREATE POLICY event_report_attachments_delete_own_or_admin ON public.event_report_attachments
  FOR DELETE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.event_reports r
      WHERE r.id = report_id AND (r.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );

CREATE INDEX event_plans_event_idx ON public.event_plans (event_id);
CREATE INDEX event_reports_event_idx ON public.event_reports (event_id);
CREATE INDEX event_report_attachments_report_idx ON public.event_report_attachments (report_id);
