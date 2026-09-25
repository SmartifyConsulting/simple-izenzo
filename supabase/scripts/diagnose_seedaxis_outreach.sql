-- Diagnoses why SeedAxis (an existing platform org) wasn't emailed about a new bid match.
-- Checks the same things counterpartyOutreach.functions.ts relies on: does SeedAxis's
-- organisation row have a contact email/website on file (that's what toEmail/website get set
-- from when a match is against an already-registered platform org), and is there a recent
-- counterparty row for them with invited_at still null (never actually emailed)?

select id, name, primary_contact_email, primary_contact_name, website
from public.organisations
where name ilike '%seedaxis%';

select cp.id, cp.name, cp.contact_email, cp.website, cp.status, cp.invited_at, cp.created_at,
       t.reference, t.title
from public.counterparties cp
join public.transactions t on t.id = cp.transaction_id
where cp.name ilike '%seedaxis%'
order by cp.created_at desc
limit 10;
