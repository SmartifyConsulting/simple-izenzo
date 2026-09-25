-- Rewinds BID9326824 back to just before Seal Intent, so the counterparty-outreach email can be
-- retested by sealing intent again. Leaves the chosen counterparty (SeedAxis) and everything about
-- it — including its contact_email, if one is already on file — untouched, since notifyChosenCounterparty
-- unconditionally re-sends on every Seal Intent, not just the first time.

update public.transactions
set
  stage = 'trading',
  step = 'poi',
  poi_sealed_at = null,
  poi_hash = null,
  -- Clear anything downstream too, in case testing had carried it further than Seal Intent.
  wad_completed_at = null,
  wad_continued_at = null,
  finality_sealed_at = null
where reference = 'BID9326824';

-- Sanity check: confirm the rewind landed, and see what's currently on file for the chosen
-- counterparty (in particular, whether contact_email is actually populated).
select t.reference, t.stage, t.step, t.poi_sealed_at,
       cp.name, cp.status, cp.contact_email, cp.website
from public.transactions t
left join public.counterparties cp on cp.transaction_id = t.id and cp.status = 'chosen'
where t.reference = 'BID9326824';
