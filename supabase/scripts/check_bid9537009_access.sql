-- Checks whether BID9537009's bidder and its matched counterparty are actually the same
-- organisation — if so, the claim link's "self" refusal
-- ("You can't accept your own bid as its counterparty.") is working exactly as designed, not a bug.

select
  t.id as transaction_id,
  t.reference,
  t.title,
  t.org_id as bidder_org_id,
  bo.name as bidder_org_name,
  t.counterparty_org_id,
  co.name as linked_counterparty_org_name,
  cp.id as counterparty_row_id,
  cp.name as counterparty_candidate_name,
  cp.contact_email
from public.transactions t
left join public.organisations bo on bo.id = t.org_id
left join public.organisations co on co.id = t.counterparty_org_id
left join public.counterparties cp on cp.transaction_id = t.id and cp.status = 'chosen'
where t.reference = 'BID9537009';
