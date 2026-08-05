CREATE TABLE public.class_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  period date NOT NULL,
  scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, period)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_scores TO authenticated;
GRANT ALL ON public.class_scores TO service_role;

ALTER TABLE public.class_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scores_select_auth" ON public.class_scores FOR SELECT TO authenticated USING (true);
CREATE POLICY "scores_admin_write" ON public.class_scores FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_class_scores_updated_at
BEFORE UPDATE ON public.class_scores
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();