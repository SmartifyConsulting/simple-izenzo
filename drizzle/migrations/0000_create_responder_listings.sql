CREATE TABLE public.responder_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organisations(id) ON DELETE CASCADE,
  name text NOT NULL,
  sector text,
  jurisdiction text,
  summary text,
  source text NOT NULL DEFAULT 'registered',
  source_url text,
  verified_at timestamptz,
  published boolean NOT NULL DEFAULT true,
  is_example boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX responder_listings_name_place_idx
  ON public.responder_listings (lower(name), coalesce(lower(jurisdiction), ''));

CREATE INDEX responder_listings_browse_idx
  ON public.responder_listings (published, source, created_at DESC);

GRANT SELECT ON public.responder_listings TO anon;
GRANT SELECT, INSERT, UPDATE ON public.responder_listings TO authenticated;
GRANT ALL ON public.responder_listings TO service_role;

ALTER TABLE public.responder_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read published listings"
  ON public.responder_listings FOR SELECT
  TO anon, authenticated
  USING (published);

CREATE POLICY "org reads own listing"
  ON public.responder_listings FOR SELECT
  TO authenticated
  USING (org_id IS NOT NULL AND org_id = public.current_org_id());

CREATE POLICY "org writes own listing"
  ON public.responder_listings FOR INSERT
  TO authenticated
  WITH CHECK (org_id IS NOT NULL AND org_id = public.current_org_id());

CREATE POLICY "org updates own listing"
  ON public.responder_listings FOR UPDATE
  TO authenticated
  USING (org_id IS NOT NULL AND org_id = public.current_org_id());

CREATE TRIGGER touch_responder_listings
  BEFORE UPDATE ON public.responder_listings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();