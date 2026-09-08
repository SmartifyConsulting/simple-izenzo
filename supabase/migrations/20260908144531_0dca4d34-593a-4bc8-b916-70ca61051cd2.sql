CREATE TABLE public.user_activity_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  event_type text NOT NULL,
  label text,
  path text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_activity_log_user_created ON public.user_activity_log (user_id, created_at DESC);

GRANT SELECT, INSERT ON public.user_activity_log TO authenticated;
GRANT ALL ON public.user_activity_log TO service_role;

ALTER TABLE public.user_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "insert own activity" ON public.user_activity_log
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "superuser reads activity" ON public.user_activity_log
  FOR SELECT TO authenticated
  USING (public.is_platform_superuser());