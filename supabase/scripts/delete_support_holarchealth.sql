-- Deletes the support@holarchealth.com account by email (not the real Holarc test account, which
-- is support@holarc.com on a different domain — this can't touch that one).
-- Run the SELECT first to confirm this is the account you mean.

select u.id as user_id, u.email, p.full_name, p.org_id, o.name as org_name
from auth.users u
left join public.profiles p on p.id = u.id
left join public.organisations o on o.id = p.org_id
where lower(u.email) = 'support@holarchealth.com';

do $$
declare
  v_user_id uuid;
  v_org_id  uuid;
begin
  select u.id, p.org_id into v_user_id, v_org_id
  from auth.users u
  left join public.profiles p on p.id = u.id
  where lower(u.email) = 'support@holarchealth.com';

  if v_user_id is null then
    raise notice 'No user with email support@holarchealth.com — nothing to delete.';
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

  raise notice 'Deleted support@holarchealth.com (user %, org %).', v_user_id, v_org_id;
end $$;
