-- One-off: give georgia.adams@smartify.co.za an organisation so account testing isn't blocked by
-- "Add your organisation details first". No-op if the user doesn't exist yet, or already belongs
-- to an organisation.
DO $$
DECLARE
  v_user_id uuid;
  v_org_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'georgia.adams@smartify.co.za' LIMIT 1;
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.org_members WHERE user_id = v_user_id) THEN
    RETURN;
  END IF;

  INSERT INTO public.organisations (name, created_by)
  VALUES ('Smartify Consulting', v_user_id)
  RETURNING id INTO v_org_id;

  INSERT INTO public.org_members (org_id, user_id, role)
  VALUES (v_org_id, v_user_id, 'owner');
END $$;
