-- A real contact email found on a counterparty's own public website (via Bright Data), plus the
-- website itself and when an invite was last sent — used to invite people who aren't yet signed
-- up to the platform so they can see they have an interested bidder.
ALTER TABLE public.counterparties ADD COLUMN IF NOT EXISTS website text;
ALTER TABLE public.counterparties ADD COLUMN IF NOT EXISTS contact_email text;
ALTER TABLE public.counterparties ADD COLUMN IF NOT EXISTS invited_at timestamptz;
