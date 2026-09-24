-- Finds every organisation named like "Holarc Health" and every profile with a holarc email, so we
-- can see whether a stale/duplicate org row (with a different primary_contact_email than the real
-- account) is what caused the counterparty-outreach Inbox notification to silently miss its match.

select id, name, primary_contact_email, created_at
from public.organisations
where name ilike '%holarc%'
order by created_at desc;

select id, email, full_name, org_id, created_at
from public.profiles
where email ilike '%holarc%'
order by created_at desc;
