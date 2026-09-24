-- Manually marks Holarc Health (Pty) Ltd as verified:
--  1. Inserts a passed KYB check into identity_verifications, which is what SubmitterIdentity.tsx
--     reads to show the "Verified through Izenzo" badge on a deal.
--  2. Sets identity_verified = true on the profile that owns it, which is what drives the
--     "Verified" badge next to the person's name on the Settings page.
-- Run the SELECT first to confirm the org id and owning profile id are the ones you expect.

select o.id as org_id, o.name, p.id as profile_id, p.email
from public.organisations o
join public.org_members m on m.org_id = o.id
join public.profiles p on p.id = m.user_id
where o.name ilike 'Holarc Health%';

do $$
declare
  v_org_id     uuid;
  v_profile_id uuid;
begin
  select o.id, p.id into v_org_id, v_profile_id
  from public.organisations o
  join public.org_members m on m.org_id = o.id
  join public.profiles p on p.id = m.user_id
  where o.name ilike 'Holarc Health%'
  limit 1;

  if v_org_id is null then
    raise notice 'No organisation matching "Holarc Health%%" — nothing to update.';
    return;
  end if;

  insert into public.identity_verifications (
    check_type, status, decision, provider, subject_org_id, reason
  ) values (
    'kyb', 'passed', 'approved', 'manual', v_org_id, 'Manually marked verified by admin'
  );

  if v_profile_id is not null then
    update public.profiles
    set identity_verified = true,
        identity_verified_reason = 'Manually marked verified by admin'
    where id = v_profile_id;
  end if;

  raise notice 'Marked org % (profile %) as verified.', v_org_id, v_profile_id;
end $$;
