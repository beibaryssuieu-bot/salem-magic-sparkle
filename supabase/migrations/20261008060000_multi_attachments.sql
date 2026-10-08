-- Есептер (reports) және ҚМЖ (event_plans) бөлімдеріне бір жазбаға бірнеше
-- файл/сілтеме тіркеу мүмкіндігін қосу. Үлгі ретінде бұрыннан бар
-- event_report_attachments кестесі алынды.

-- 1) Есептерге арналған тіркемелер
CREATE TABLE public.report_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
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
GRANT SELECT, INSERT, DELETE ON public.report_attachments TO authenticated;
GRANT ALL ON public.report_attachments TO service_role;
ALTER TABLE public.report_attachments ENABLE ROW LEVEL SECURITY;

-- reports кестесінің өзі owner-or-admin ғана көре алатындай жабық болғандықтан,
-- тіркемелер де сол үлгіні қайталайды (event_report_attachments-тен айырмашылығы осы).
CREATE POLICY report_attachments_select_own_or_admin ON public.report_attachments
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.reports r
      WHERE r.id = report_id AND (r.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );
CREATE POLICY report_attachments_insert_own ON public.report_attachments
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.reports r WHERE r.id = report_id AND r.user_id = auth.uid())
  );
CREATE POLICY report_attachments_delete_own_or_admin ON public.report_attachments
  FOR DELETE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.reports r
      WHERE r.id = report_id AND (r.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );

CREATE INDEX report_attachments_report_idx ON public.report_attachments (report_id);

-- Бұрыннан бар жалғыз файл/сілтемені жаңа кестеге көшіру
INSERT INTO public.report_attachments (report_id, kind, file_path, file_name, file_type, created_at)
SELECT id, 'file', file_path, file_name, file_type, created_at
FROM public.reports WHERE file_path IS NOT NULL;

INSERT INTO public.report_attachments (report_id, kind, link_url, created_at)
SELECT id, 'link', link_url, created_at
FROM public.reports WHERE link_url IS NOT NULL;

-- Ескі "файл немесе сілтеме міндетті" шектеуі енді тіркемелер кестесіне
-- қатысты болғандықтан, reports деңгейінде алынып тасталады (өрістердің
-- өзі деректерді сақтау үшін әлі де қалады, бірақ қолданылмайды).
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_file_or_link_check;


-- 2) ҚМЖ-ға (event_plans) арналған тіркемелер
CREATE TABLE public.event_plan_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.event_plans(id) ON DELETE CASCADE,
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
GRANT SELECT, INSERT, DELETE ON public.event_plan_attachments TO authenticated;
GRANT ALL ON public.event_plan_attachments TO service_role;
ALTER TABLE public.event_plan_attachments ENABLE ROW LEVEL SECURITY;

-- event_plans барлық аутентификацияланған пайдаланушыға ашық (event_report_attachments
-- үлгісімен бірдей), сондықтан select саясаты да ашық.
CREATE POLICY event_plan_attachments_select_auth ON public.event_plan_attachments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY event_plan_attachments_insert_own ON public.event_plan_attachments
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.event_plans p WHERE p.id = plan_id AND p.user_id = auth.uid())
  );
CREATE POLICY event_plan_attachments_delete_own_or_admin ON public.event_plan_attachments
  FOR DELETE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.event_plans p
      WHERE p.id = plan_id AND (p.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );

CREATE INDEX event_plan_attachments_plan_idx ON public.event_plan_attachments (plan_id);

INSERT INTO public.event_plan_attachments (plan_id, kind, file_path, file_name, file_type, created_at)
SELECT id, 'file', file_path, file_name, file_type, created_at
FROM public.event_plans WHERE file_path IS NOT NULL;

INSERT INTO public.event_plan_attachments (plan_id, kind, link_url, created_at)
SELECT id, 'link', link_url, created_at
FROM public.event_plans WHERE link_url IS NOT NULL;

-- event_plans-тың бастапқы миграциясында аты көрсетілмеген CHECK
-- (file_path IS NOT NULL OR link_url IS NOT NULL) болғандықтан, атын
-- pg_constraint-тен тауып алып тастаймыз.
DO $$
DECLARE
  c_name text;
BEGIN
  SELECT conname INTO c_name
  FROM pg_constraint
  WHERE conrelid = 'public.event_plans'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%file_path%link_url%';
  IF c_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.event_plans DROP CONSTRAINT %I', c_name);
  END IF;
END $$;
