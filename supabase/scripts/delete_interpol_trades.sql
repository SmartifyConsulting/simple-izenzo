-- Deletes the three INTERPOL demo cases (org "INTERPOL Demonstrator", workflow_template_key
-- 'interpol_investigation') and everything filed against them. Confirmed live against the actual
-- data before writing this: INV3217492, INV6684138, INV1404732 — all three, no counterparty set.
--
-- The four INTERPOL-specific tables (case_evidence, case_leads, case_wad_checks, case_closures)
-- already cascade on transaction delete, so they don't need an explicit delete here — but every
-- other table that references transactions does need one, since those weren't all declared with
-- ON DELETE CASCADE.

-- Preview first — confirm this is exactly the three cases before running the deletes below.
select id, reference, title, org_id
from public.transactions
where org_id = (select id from public.organisations where workflow_template_key = 'interpol_investigation');

with targets as (
  select id from public.transactions
  where org_id = (select id from public.organisations where workflow_template_key = 'interpol_investigation')
)
delete from public.document_signatures where document_id in (select id from public.documents where transaction_id in (select id from targets));

with targets as (
  select id from public.transactions
  where org_id = (select id from public.organisations where workflow_template_key = 'interpol_investigation')
)
delete from public.documents where transaction_id in (select id from targets);

with targets as (
  select id from public.transactions
  where org_id = (select id from public.organisations where workflow_template_key = 'interpol_investigation')
)
delete from public.bid_offers where transaction_id in (select id from targets);

with targets as (
  select id from public.transactions
  where org_id = (select id from public.organisations where workflow_template_key = 'interpol_investigation')
)
delete from public.counterparties where transaction_id in (select id from targets);

with targets as (
  select id from public.transactions
  where org_id = (select id from public.organisations where workflow_template_key = 'interpol_investigation')
)
delete from public.engagement_responses where transaction_id in (select id from targets);

with targets as (
  select id from public.transactions
  where org_id = (select id from public.organisations where workflow_template_key = 'interpol_investigation')
)
delete from public.execution_records where transaction_id in (select id from targets);

with targets as (
  select id from public.transactions
  where org_id = (select id from public.organisations where workflow_template_key = 'interpol_investigation')
)
delete from public.transaction_events where transaction_id in (select id from targets);

with targets as (
  select id from public.transactions
  where org_id = (select id from public.organisations where workflow_template_key = 'interpol_investigation')
)
delete from public.notifications where transaction_id in (select id from targets);

-- The transactions themselves — case_evidence/case_leads/case_wad_checks/case_closures cascade
-- automatically from this.
delete from public.transactions
where org_id = (select id from public.organisations where workflow_template_key = 'interpol_investigation');
