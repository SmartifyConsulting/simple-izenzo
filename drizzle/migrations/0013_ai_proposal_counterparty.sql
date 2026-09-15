-- AI+ proposals didn't say which counterparty they were about, even when the advice was clearly
-- about one specific party — nothing to show in the panel beyond the free-text summary.
ALTER TABLE public.ai_proposals ADD COLUMN IF NOT EXISTS related_counterparty TEXT;
