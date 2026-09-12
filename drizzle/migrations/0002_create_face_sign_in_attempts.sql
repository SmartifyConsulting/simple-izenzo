CREATE TABLE public.face_sign_in_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_session_id text,
  provider_url text,
  status text NOT NULL DEFAULT 'pending',
  decision text,
  reason text,
  consumed_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '20 minutes'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX face_sign_in_attempts_email_idx ON public.face_sign_in_attempts (lower(email));
CREATE INDEX face_sign_in_attempts_session_idx ON public.face_sign_in_attempts (provider_session_id);

GRANT ALL ON public.face_sign_in_attempts TO service_role;

ALTER TABLE public.face_sign_in_attempts ENABLE ROW LEVEL SECURITY;
-- No anon/authenticated policies: this table is only ever touched by trusted server code.