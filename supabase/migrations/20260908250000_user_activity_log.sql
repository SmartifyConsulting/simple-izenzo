-- Records every click and page navigation, per user, for the Audit Log admin screen.
-- Only the system administrator (georgia.adams@smartify.co.za) may read it; every
-- authenticated user may write rows for their own activity only.

CREATE TABLE IF NOT EXISTS public.user_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('click', 'navigation')),
  label text,
  path text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_activity_log_occurred_at_idx ON public.user_activity_log (occurred_at DESC);
CREATE INDEX IF NOT EXISTS user_activity_log_user_id_idx ON public.user_activity_log (user_id);

ALTER TABLE public.user_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users insert own activity" ON public.user_activity_log FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "system admin reads all activity" ON public.user_activity_log FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM auth.users u WHERE u.id = auth.uid() AND u.email = 'georgia.adams@smartify.co.za'));
