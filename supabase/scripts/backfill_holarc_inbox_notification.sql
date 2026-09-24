-- Backfills the Inbox notification that should have been written when Holarc Health (Pty) Ltd was
-- matched to BID9537009 (counterparty d6ecf4ae-93ac-4fde-a3cf-d3ce615d181d, transaction
-- 47f9ce48-a83b-4145-b291-e696fd6e59bd) but was silently skipped because the outreach email's
-- address matched a stale duplicate org instead of the real support@holarchealth.com profile.
-- Wording matches exactly what counterpartyOutreach.functions.ts would have written.

-- Run supabase/migrations/20260928000000_notification_claim_link.sql first if it hasn't been run
-- yet — claim_counterparty_id doesn't exist on notifications before that.
insert into public.notifications (user_id, org_id, transaction_id, title, body, claim_counterparty_id)
select
  p.id,
  p.org_id,
  '47f9ce48-a83b-4145-b291-e696fd6e59bd',
  'BID9537009 — you''ve been matched to a live opportunity',
  'Holarc Health (Pty) Ltd has been selected as a potential counterparty for Holarc Health New Bid BID9537009. Open the deal to see the full details and respond.',
  'd6ecf4ae-93ac-4fde-a3cf-d3ce615d181d'
from public.profiles p
where lower(p.email) = 'support@holarchealth.com';
