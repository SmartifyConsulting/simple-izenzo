-- Spreads every existing trade's created_at/updated_at across August through now, with a bias
-- toward more recent activity, so the Trades screen's month accordions actually have more than one
-- month to show. Replaces the earlier last-7-days-only version. Test/demo data only — safe to
-- re-run any time, it just re-randomizes the dates again.
--
-- Roughly a third of rows land in August, the rest spread across September up to today — adjust
-- the "case" weighting below if you want a different split.

update public.transactions t
set
  created_at = sub.new_created,
  -- Never before created_at, never after now — picks a random point in between.
  updated_at = sub.new_created + (random() * (now() - sub.new_created))
from (
  select
    id,
    case
      when random() < 0.35 then
        -- Somewhere in August (the 1st through the 31st).
        date_trunc('month', now()) - interval '1 month' + (random() * interval '30 days')
      else
        -- Somewhere from the start of September up to right now.
        least(date_trunc('month', now()), now()) + (random() * (now() - date_trunc('month', now())))
    end as new_created
  from public.transactions
) sub
where t.id = sub.id;

-- Sanity check: confirms nothing landed outside the intended range and nothing is null.
select
  date_trunc('month', created_at) as month,
  count(*) as trades,
  min(created_at) as earliest,
  max(created_at) as latest
from public.transactions
group by 1
order by 1 desc;
