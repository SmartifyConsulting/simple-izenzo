-- A counterparty-match notification used to link straight to the transaction, which the matched
-- org can't see yet (counterparty_org_id is still null until they click the claim link) — a dead
-- end for anyone who found the match through their in-app Inbox rather than the outreach email.
-- This lets that notification instead point at /counterparty/claim, the flow that actually links
-- their org and grants access.
alter table public.notifications
  add column if not exists claim_counterparty_id uuid references public.counterparties(id) on delete set null;
