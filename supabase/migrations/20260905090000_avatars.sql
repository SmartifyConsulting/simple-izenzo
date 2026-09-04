-- Profile pictures (per user) and organisation avatars/logos
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.organisations ADD COLUMN IF NOT EXISTS avatar_url text;

-- What the organisation offers, shown to counterparties evaluating a bid
ALTER TABLE public.organisations ADD COLUMN IF NOT EXISTS offerings text;
ALTER TABLE public.organisations ADD COLUMN IF NOT EXISTS website text;

-- Portfolio: products/services an organisation showcases
CREATE TABLE public.org_portfolio_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_portfolio_items TO authenticated;
GRANT ALL ON public.org_portfolio_items TO service_role;
ALTER TABLE public.org_portfolio_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read portfolio items" ON public.org_portfolio_items FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "members write portfolio items" ON public.org_portfolio_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.org_members m WHERE m.org_id = org_portfolio_items.org_id AND m.user_id = auth.uid()));
CREATE POLICY "members update portfolio items" ON public.org_portfolio_items FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.org_members m WHERE m.org_id = org_portfolio_items.org_id AND m.user_id = auth.uid()));
CREATE POLICY "members delete portfolio items" ON public.org_portfolio_items FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.org_members m WHERE m.org_id = org_portfolio_items.org_id AND m.user_id = auth.uid()));

CREATE POLICY "members manage portfolio images" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars' AND (storage.foldername(name))[1] = 'portfolio'
    AND EXISTS (
      SELECT 1 FROM public.org_members m
      WHERE m.org_id::text = (storage.foldername(name))[2] AND m.user_id = auth.uid()
    )
  );

-- Public storage bucket for both, keyed by folder: users/<uid>/..., orgs/<org_id>/...
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "avatars are publicly readable" ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "users manage their own avatar" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = 'users' AND (storage.foldername(name))[2] = auth.uid()::text);
CREATE POLICY "users update their own avatar" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = 'users' AND (storage.foldername(name))[2] = auth.uid()::text);
CREATE POLICY "users delete their own avatar" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = 'users' AND (storage.foldername(name))[2] = auth.uid()::text);

CREATE POLICY "members manage their org avatar" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars' AND (storage.foldername(name))[1] = 'orgs'
    AND EXISTS (
      SELECT 1 FROM public.org_members m
      WHERE m.org_id::text = (storage.foldername(name))[2] AND m.user_id = auth.uid()
    )
  );
CREATE POLICY "members update their org avatar" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars' AND (storage.foldername(name))[1] = 'orgs'
    AND EXISTS (
      SELECT 1 FROM public.org_members m
      WHERE m.org_id::text = (storage.foldername(name))[2] AND m.user_id = auth.uid()
    )
  );
CREATE POLICY "members delete their org avatar" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars' AND (storage.foldername(name))[1] = 'orgs'
    AND EXISTS (
      SELECT 1 FROM public.org_members m
      WHERE m.org_id::text = (storage.foldername(name))[2] AND m.user_id = auth.uid()
    )
  );
