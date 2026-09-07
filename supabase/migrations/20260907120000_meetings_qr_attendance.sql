-- Мұғалімдер жиналысына QR-код арқылы қатысуды тіркеу модулі.
-- "teachers" атауын профильдегі (логині бар) пайдаланушылармен шатастырмау үшін
-- бұл кестелер "meeting_" префиксімен аталады: жиналысқа QR арқылы тіркелетін
-- ~200 қызметкер логинсіз, өз атын қолмен енгізіп тіркеледі.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Жиналыстың QR сілтемесі үшін URL-қауіпсіз кездейсоқ токен.
CREATE OR REPLACE FUNCTION public.generate_qr_token()
RETURNS text
LANGUAGE sql
AS $$
  SELECT translate(encode(gen_random_bytes(12), 'base64'), '+/=', '-_')
$$;

-- Жиналыстар: әр жиналыстың өз бірегей QR токені бар.
CREATE TABLE public.meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  meeting_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  location text,
  expected_count integer NOT NULL DEFAULT 200 CHECK (expected_count >= 0),
  registration_open boolean NOT NULL DEFAULT true,
  qr_token text NOT NULL DEFAULT public.generate_qr_token(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX meetings_qr_token_idx ON public.meetings (qr_token);
CREATE INDEX meetings_date_idx ON public.meetings (meeting_date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meetings TO authenticated;
GRANT ALL ON public.meetings TO service_role;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

-- Анонимді (QR сканерлеген) пайдаланушыларға жиналыс кестесіне тікелей қолжетімділік
-- жоқ — тек төмендегі SECURITY DEFINER функциялары арқылы ғана.
CREATE POLICY meetings_select_auth ON public.meetings FOR SELECT TO authenticated USING (true);
CREATE POLICY meetings_admin_write ON public.meetings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_meetings_updated_at BEFORE UPDATE ON public.meetings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Жиналысқа QR арқылы өзін-өзі тіркейтін қызметкерлер (логинсіз).
CREATE TABLE public.meeting_teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  full_name_key text NOT NULL,
  position text NOT NULL,
  department text NOT NULL,
  school text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX meeting_teachers_name_key_idx ON public.meeting_teachers (full_name_key);

GRANT SELECT, UPDATE, DELETE ON public.meeting_teachers TO authenticated;
GRANT ALL ON public.meeting_teachers TO service_role;
ALTER TABLE public.meeting_teachers ENABLE ROW LEVEL SECURITY;

CREATE POLICY meeting_teachers_select_admin ON public.meeting_teachers FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY meeting_teachers_admin_write ON public.meeting_teachers FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY meeting_teachers_admin_delete ON public.meeting_teachers FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_meeting_teachers_updated_at BEFORE UPDATE ON public.meeting_teachers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Бір жиналысқа бір мұғалім тек бір рет тіркеле алады.
CREATE TABLE public.meeting_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.meeting_teachers(id) ON DELETE CASCADE,
  registered_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (meeting_id, teacher_id)
);
CREATE INDEX meeting_attendance_meeting_idx ON public.meeting_attendance (meeting_id);
CREATE INDEX meeting_attendance_teacher_idx ON public.meeting_attendance (teacher_id);

GRANT SELECT, DELETE ON public.meeting_attendance TO authenticated;
GRANT ALL ON public.meeting_attendance TO service_role;
ALTER TABLE public.meeting_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY meeting_attendance_select_admin ON public.meeting_attendance FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY meeting_attendance_admin_delete ON public.meeting_attendance FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Статистика бетінде кафедра бойынша «шақырылған» санын көрсету үшін
-- әкімші әр жиналысқа кафедра бойынша күтілетін сан қоя алады (міндетті емес).
CREATE TABLE public.meeting_department_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  department text NOT NULL,
  expected_count integer NOT NULL DEFAULT 0 CHECK (expected_count >= 0),
  UNIQUE (meeting_id, department)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meeting_department_targets TO authenticated;
GRANT ALL ON public.meeting_department_targets TO service_role;
ALTER TABLE public.meeting_department_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY meeting_department_targets_select_auth ON public.meeting_department_targets
  FOR SELECT TO authenticated USING (true);
CREATE POLICY meeting_department_targets_admin_write ON public.meeting_department_targets FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Real-time: қатысу тіркелген сәтте админ дэшборды дереу жаңарту үшін.
ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_attendance;

-- Тіркеу (check-in) — анонимді пайдаланушы шақыратын жалғыз жазу нүктесі.
-- Мұғалімді аты бойынша табады/жасайды және qатысуды атомды түрде сақтайды,
-- сол арқылы meeting_id+teacher_id қайталануын дерекқор деңгейінде болдырмайды.
CREATE OR REPLACE FUNCTION public.checkin_meeting_attendance(
  p_qr_token text,
  p_full_name text,
  p_position text,
  p_department text,
  p_school text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meeting public.meetings%ROWTYPE;
  v_name_key text;
  v_teacher_id uuid;
  v_existing public.meeting_attendance%ROWTYPE;
  v_attendance public.meeting_attendance%ROWTYPE;
BEGIN
  v_name_key := lower(regexp_replace(btrim(coalesce(p_full_name, '')), '\s+', ' ', 'g'));
  IF v_name_key = '' THEN
    RETURN jsonb_build_object('status', 'invalid_fields');
  END IF;
  IF coalesce(btrim(p_position), '') = '' OR coalesce(btrim(p_department), '') = ''
     OR coalesce(btrim(p_school), '') = '' THEN
    RETURN jsonb_build_object('status', 'invalid_fields');
  END IF;

  SELECT * INTO v_meeting FROM public.meetings WHERE qr_token = p_qr_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;
  IF NOT v_meeting.registration_open THEN
    RETURN jsonb_build_object('status', 'closed', 'meeting', to_jsonb(v_meeting));
  END IF;

  SELECT id INTO v_teacher_id FROM public.meeting_teachers WHERE full_name_key = v_name_key;
  IF v_teacher_id IS NULL THEN
    INSERT INTO public.meeting_teachers (full_name, full_name_key, position, department, school)
    VALUES (btrim(p_full_name), v_name_key, btrim(p_position), btrim(p_department), btrim(p_school))
    RETURNING id INTO v_teacher_id;
  ELSE
    UPDATE public.meeting_teachers
    SET position = btrim(p_position), department = btrim(p_department), school = btrim(p_school)
    WHERE id = v_teacher_id;
  END IF;

  SELECT * INTO v_existing FROM public.meeting_attendance
  WHERE meeting_id = v_meeting.id AND teacher_id = v_teacher_id;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'status', 'duplicate',
      'registered_at', v_existing.registered_at,
      'meeting', to_jsonb(v_meeting),
      'teacher_id', v_teacher_id
    );
  END IF;

  INSERT INTO public.meeting_attendance (meeting_id, teacher_id)
  VALUES (v_meeting.id, v_teacher_id)
  RETURNING * INTO v_attendance;

  RETURN jsonb_build_object(
    'status', 'ok',
    'registered_at', v_attendance.registered_at,
    'meeting', to_jsonb(v_meeting),
    'teacher_id', v_teacher_id
  );
EXCEPTION
  WHEN unique_violation THEN
    -- Жарыс жағдайы: сол мұғалім екі құрылғыдан бір мезгілде жіберсе.
    SELECT * INTO v_existing FROM public.meeting_attendance
    WHERE meeting_id = v_meeting.id AND teacher_id = v_teacher_id;
    RETURN jsonb_build_object(
      'status', 'duplicate',
      'registered_at', v_existing.registered_at,
      'meeting', to_jsonb(v_meeting),
      'teacher_id', v_teacher_id
    );
END;
$$;

REVOKE ALL ON FUNCTION public.checkin_meeting_attendance(text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.checkin_meeting_attendance(text, text, text, text, text) TO anon, authenticated, service_role;

-- QR бетін ашқанда: жиналыс табылды ма / жабық па / бұл адам бұрын тіркелген бе — жазусыз тексеру.
CREATE OR REPLACE FUNCTION public.get_meeting_registration_status(
  p_qr_token text,
  p_full_name text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meeting public.meetings%ROWTYPE;
  v_name_key text;
  v_existing public.meeting_attendance%ROWTYPE;
BEGIN
  SELECT * INTO v_meeting FROM public.meetings WHERE qr_token = p_qr_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;
  IF NOT v_meeting.registration_open THEN
    RETURN jsonb_build_object('status', 'closed', 'meeting', to_jsonb(v_meeting));
  END IF;

  v_name_key := lower(regexp_replace(btrim(coalesce(p_full_name, '')), '\s+', ' ', 'g'));
  IF v_name_key <> '' THEN
    SELECT a.* INTO v_existing
    FROM public.meeting_attendance a
    JOIN public.meeting_teachers t ON t.id = a.teacher_id
    WHERE a.meeting_id = v_meeting.id AND t.full_name_key = v_name_key;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'status', 'duplicate',
        'registered_at', v_existing.registered_at,
        'meeting', to_jsonb(v_meeting)
      );
    END IF;
  END IF;

  RETURN jsonb_build_object('status', 'open', 'meeting', to_jsonb(v_meeting));
END;
$$;

REVOKE ALL ON FUNCTION public.get_meeting_registration_status(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_meeting_registration_status(text, text) TO anon, authenticated, service_role;
