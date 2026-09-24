-- Deletes one specific test user by id: 1d9cc9e6-653f-4eaa-9808-110802ee2b6a
-- Keyed on the exact id, not an email/name pattern, so it can't touch anything else.
-- Run the SELECT first to confirm this is the right account before running the DO block.

select u.id as user_id, u.email, p.full_name, p.org_id, o.name as org_name
from auth.users u
left join public.profiles p on p.id = u.id
left join public.organisations o on o.id = p.org_id
where u.id = '1d9cc9e6-653f-4eaa-9808-110802ee2b6a';

do $$
declare
  v_user_id uuid := '1d9cc9e6-653f-4eaa-9808-110802ee2b6a';
  v_org_id  uuid;
begin
  select org_id into v_org_id from public.profiles where id = v_user_id;

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
  if v_org_id is not null and not exists (
    select 1 from public.org_members where org_id = v_org_id
  ) then
    delete from public.organisations where id = v_org_id;
  end if;

  raise notice 'Deleted user % (org %).', v_user_id, v_org_id;
end $$;
