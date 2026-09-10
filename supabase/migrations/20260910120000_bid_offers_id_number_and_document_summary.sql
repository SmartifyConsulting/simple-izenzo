-- The ID Number captured on the simplified Submit a Bid/Offer form (replaces the old
-- title/commodity/quantity/price fields on that first screen — those now come from the AI
-- summary of the uploaded documents instead).
ALTER TABLE public.bid_offers ADD COLUMN IF NOT EXISTS id_number text;

-- The AI-generated summary of whatever ID/documents were uploaded for a transaction, and when it
-- was last written. Stored on the transaction (rather than per-document) since it's one summary
-- covering everything the bidder/responder attached.
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS document_summary text;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS document_summary_generated_at timestamptz;
