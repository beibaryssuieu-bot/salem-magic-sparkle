-- Есептер бөліміне уведомление жүйесі мен сілтеме арқылы тапсыру мүмкіндігін қосу.
-- Қолданыстағы reports кестесі мен reports storage bucket-і сақталады, тек
-- жаңа өрістер қосылады.

-- Сілтеме арқылы тапсыру: файл міндетті болмауы үшін nullable етеміз.
ALTER TABLE public.reports ALTER COLUMN file_path DROP NOT NULL;
ALTER TABLE public.reports ALTER COLUMN file_name DROP NOT NULL;

ALTER TABLE public.reports ADD COLUMN link_url text;

-- Админ есепті ашып қарағанша 'pending', ашқаннан кейін 'viewed' болады.
-- Бұрыннан бар жазбалар (осы миграцияға дейінгі есептер) әкімшіге жалған
-- «жаңа есеп» ретінде көрінбеу үшін 'viewed' болып бастапталады, ал жаңа
-- жазбалар үшін әдепкі мән 'pending' болады.
ALTER TABLE public.reports ADD COLUMN status text NOT NULL DEFAULT 'viewed';
ALTER TABLE public.reports ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE public.reports ADD CONSTRAINT reports_status_check
  CHECK (status IN ('pending', 'viewed'));

ALTER TABLE public.reports ADD COLUMN viewed_at timestamptz;

-- Файл немесе сілтеменің кемінде біреуі болуы міндетті.
ALTER TABLE public.reports ADD CONSTRAINT reports_file_or_link_check
  CHECK (file_path IS NOT NULL OR link_url IS NOT NULL);

CREATE INDEX reports_status_idx ON public.reports (status);
CREATE INDEX reports_class_status_idx ON public.reports (class_id, status);
