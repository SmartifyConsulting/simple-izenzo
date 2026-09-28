ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text, ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_unique ON public.profiles (phone) WHERE phone IS NOT NULL;

CREATE TABLE public.phone_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  purpose text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  consumed_at timestamptz,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX phone_otps_phone_idx ON public.phone_otps (phone, purpose, created_at DESC);
GRANT ALL ON public.phone_otps TO service_role;
ALTER TABLE public.phone_otps ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.integration_custom_providers (
  id text PRIMARY KEY,
  name text NOT NULL,
  summary text NOT NULL DEFAULT '',
  console_url text,
  docs_url text,
  top_up_url text,
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integration_custom_providers TO authenticated;
GRANT ALL ON public.integration_custom_providers TO service_role;
ALTER TABLE public.integration_custom_providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage custom integrations" ON public.integration_custom_providers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));