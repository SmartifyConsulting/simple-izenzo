-- A human-facing reference shown across the app (BID9088778.../OFF8979667...), generated
-- client-side when a bid/offer is first recorded and stored here so it's visible everywhere the
-- transaction is listed, not just in the browser tab that created it.
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS reference text;
