-- Deletes the stale duplicate "Holarc Health (Pty) Ltd" org (acccb30b-a168-4ee7-bbd8-47ed32822903)
-- AND its one member, the throwaway wizardtest.20260924a@izenzo-test.com test account created
-- during signup-wizard debugging. Both are pure test data with no real value.
-- Run the SELECT first to confirm this is still the right account before deleting.

select u.id as user_id, u.email, o.id as org_id, o.name, o.primary_contact_email
from public.organisations o
join public.org_members m on m.org_id = o.id
join auth.users u on u.id = m.user_id
where o.id = 'acccb30b-a168-4ee7-bbd8-47ed32822903';

do $$
declare
  v_org_id  uuid := 'acccb30b-a168-4ee7-bbd8-47ed32822903';
  v_user_id uuid;
begin
  select user_id into v_user_id from public.org_members where org_id = v_org_id limit 1;

  if v_user_id is not null then
    delete from public.user_roles where user_id = v_user_id;
    delete from public.org_members where user_id = v_user_id;
    delete from public.profiles where id = v_user_id;
    delete from auth.identities where user_id = v_user_id;
    delete from auth.users where id = v_user_id;
  end if;

  delete from public.organisations where id = v_org_id;

  raise notice 'Deleted stale org % and user %.', v_org_id, v_user_id;
end $$;
