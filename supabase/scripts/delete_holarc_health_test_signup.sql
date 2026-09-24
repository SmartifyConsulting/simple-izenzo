-- Deletes the "Holarc Health (Pty) Ltd" test signup (support@holarchealth.com), keyed on the exact
-- ids confirmed by find_holarc_health_test_signup.sql — not a name/email pattern match — so this
-- cannot touch the real "Holarc" test account (support@holarc.com, a different domain) or anything
-- else.

do $$
declare
  v_user_id uuid := '9162c513-4a42-4f08-a179-ae04953e0073';
  v_org_id  uuid := '37320b3d-86b9-422e-b65e-a8c193343d2d';
begin
  if not exists (select 1 from auth.users where id = v_user_id) then
    raise notice 'User % no longer exists — nothing to delete.', v_user_id;
    return;
  end if;

  delete from public.user_roles where user_id = v_user_id;
  delete from public.org_members where user_id = v_user_id;
  delete from public.profiles where id = v_user_id;
  delete from auth.identities where user_id = v_user_id;
  delete from auth.users where id = v_user_id;

  -- Only remove the organisation if this was its last member.
  if not exists (select 1 from public.org_members where org_id = v_org_id) then
    delete from public.organisations where id = v_org_id;
  end if;

  raise notice 'Deleted Holarc Health test signup (user %, org %).', v_user_id, v_org_id;
end $$;
