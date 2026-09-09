DO $$
DECLARE
  u RECORD;
  link public.pending_user_links%ROWTYPE;
  r text;
  m jsonb;
  new_org uuid;
BEGIN
  -- 1. Backfill missing profiles for existing auth users
  FOR u IN
    SELECT au.id, au.email, au.raw_user_meta_data
    FROM auth.users au
    LEFT JOIN public.profiles p ON p.id = au.id
    WHERE p.id IS NULL
  LOOP
    SELECT * INTO link FROM public.pending_user_links
     WHERE lower(email) = lower(u.email) AND applied_at IS NULL;

    INSERT INTO public.profiles (id, email, full_name, org_id, seat)
    VALUES (
      u.id,
      u.email,
      COALESCE(link.full_name, u.raw_user_meta_data->>'full_name', u.email),
      link.org_id,
      COALESCE(link.seat, 'party')
    );

    INSERT INTO public.user_roles (user_id, role) VALUES (u.id, 'party') ON CONFLICT DO NOTHING;

    IF link.email IS NOT NULL THEN
      FOREACH r IN ARRAY link.roles LOOP
        INSERT INTO public.user_roles (user_id, role) VALUES (u.id, r::app_role) ON CONFLICT DO NOTHING;
      END LOOP;

      FOR m IN SELECT * FROM jsonb_array_elements(link.memberships) LOOP
        INSERT INTO public.org_members (org_id, user_id, role)
        VALUES ((m->>'org_id')::uuid, u.id, COALESCE(m->>'role', 'member'));
      END LOOP;

      UPDATE public.pending_user_links SET applied_at = now() WHERE email = link.email;
    END IF;

    link := NULL;
  END LOOP;

  -- 2. Every profile must belong to an organisation
  FOR u IN
    SELECT p.id, p.email, p.full_name
    FROM public.profiles p
    WHERE p.org_id IS NULL
  LOOP
    SELECT om.org_id INTO new_org
    FROM public.org_members om
    WHERE om.user_id = u.id
    ORDER BY om.created_at
    LIMIT 1;

    IF new_org IS NULL THEN
      INSERT INTO public.organisations (name, created_by)
      VALUES (COALESCE(u.full_name, u.email, 'My account'), u.id)
      RETURNING id INTO new_org;

      INSERT INTO public.org_members (org_id, user_id, role)
      VALUES (new_org, u.id, 'owner');
    END IF;

    UPDATE public.profiles SET org_id = new_org WHERE id = u.id;
    new_org := NULL;
  END LOOP;
END $$;