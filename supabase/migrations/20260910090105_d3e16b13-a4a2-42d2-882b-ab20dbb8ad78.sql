-- 1. Re-attach automatic profile creation for new sign-ups
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Backfill missing profile rows from auth.users, reusing pending_user_links where the email matches
INSERT INTO public.profiles (id, email, full_name, org_id, seat)
SELECT u.id,
       u.email,
       COALESCE(l.full_name, u.raw_user_meta_data->>'full_name', u.email),
       l.org_id,
       COALESCE(l.seat, 'party')
FROM auth.users u
LEFT JOIN public.pending_user_links l ON lower(l.email) = lower(u.email)
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'party'::public.app_role FROM public.profiles p
ON CONFLICT DO NOTHING;

-- 3. Every profile without a company: adopt an existing membership, else create a personal org
DO $$
DECLARE
  rec record;
  v_org uuid;
BEGIN
  FOR rec IN SELECT p.id, p.full_name, p.email FROM public.profiles p WHERE p.org_id IS NULL LOOP
    SELECT m.org_id INTO v_org FROM public.org_members m WHERE m.user_id = rec.id LIMIT 1;

    IF v_org IS NULL THEN
      INSERT INTO public.organisations (name, created_by)
      VALUES (COALESCE(NULLIF(trim(rec.full_name), ''), rec.email, 'My account'), rec.id)
      RETURNING id INTO v_org;

      INSERT INTO public.org_members (org_id, user_id, role)
      VALUES (v_org, rec.id, 'owner');
    END IF;

    UPDATE public.profiles SET org_id = v_org, updated_at = now() WHERE id = rec.id;
  END LOOP;
END $$;