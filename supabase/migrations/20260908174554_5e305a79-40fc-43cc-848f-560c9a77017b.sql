CREATE TABLE public.pending_user_links (
  email text PRIMARY KEY,
  full_name text,
  seat text NOT NULL DEFAULT 'party',
  org_id uuid REFERENCES public.organisations(id),
  roles text[] NOT NULL DEFAULT '{}',
  memberships jsonb NOT NULL DEFAULT '[]'::jsonb,
  applied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.pending_user_links TO service_role;

ALTER TABLE public.pending_user_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System admin can view pending links"
  ON public.pending_user_links FOR SELECT
  TO authenticated
  USING (public.is_platform_superuser());

GRANT SELECT ON public.pending_user_links TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  link public.pending_user_links%ROWTYPE;
  r text;
  m jsonb;
BEGIN
  SELECT * INTO link FROM public.pending_user_links
   WHERE lower(email) = lower(NEW.email) AND applied_at IS NULL;

  INSERT INTO public.profiles (id, email, full_name, org_id, seat)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(link.full_name, NEW.raw_user_meta_data->>'full_name', NEW.email),
    link.org_id,
    COALESCE(link.seat, 'party')
  );

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'party') ON CONFLICT DO NOTHING;

  IF link.email IS NOT NULL THEN
    FOREACH r IN ARRAY link.roles LOOP
      INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, r::app_role) ON CONFLICT DO NOTHING;
    END LOOP;

    FOR m IN SELECT * FROM jsonb_array_elements(link.memberships) LOOP
      INSERT INTO public.org_members (org_id, user_id, role)
      VALUES ((m->>'org_id')::uuid, NEW.id, COALESCE(m->>'role', 'member'));
    END LOOP;

    UPDATE public.pending_user_links SET applied_at = now() WHERE email = link.email;
  END IF;

  RETURN NEW;
END; $function$;