-- Spreads every existing trade's created_at/updated_at randomly across the last 7 days, so the
-- Trades screen's Created/Last Updated columns and month-accordion grouping have real variety to
-- show instead of every row sitting on the same day. Test/demo data only — not a migration, safe
-- to run repeatedly (it just re-randomizes the dates each time).

update public.transactions t
set
  created_at = sub.new_created,
  -- Never before created_at — picks a random point between the new created_at and now.
  updated_at = sub.new_created + (random() * (now() - sub.new_created))
from (
  select id, now() - (random() * interval '7 days') as new_created
  from public.transactions
) sub
where t.id = sub.id;
