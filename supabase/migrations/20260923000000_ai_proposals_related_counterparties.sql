-- AI+ moved from "advise on the counterparty you already picked" to "analyse the whole result set
-- before you pick" — a proposal can now legitimately concern several candidates at once (a bundle,
-- a substitution among two named alternatives), not just one. related_counterparty (singular) is
-- kept for back-compat with anything still reading it; related_counterparties is the array going
-- forward.
alter table public.ai_proposals
  add column if not exists related_counterparties jsonb;

comment on column public.ai_proposals.related_counterparties is
  'Every counterparty name this proposal concerns, as a JSON array of strings — e.g. a bundle or substitution proposal naming two or more candidates. related_counterparty (singular) still holds the first name for older code paths.';
