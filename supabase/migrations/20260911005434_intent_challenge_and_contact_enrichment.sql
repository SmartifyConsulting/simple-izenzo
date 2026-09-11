-- A back-and-forth challenge thread on the Confirm Intent step: the bidder or the chosen
-- counterparty can raise a question or objection before intent is confirmed. Every message is
-- also logged into transaction_events so it shows up in the Bid's Logs.
CREATE TABLE IF NOT EXISTS public.intent_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.intent_messages ENABLE ROW LEVEL SECURITY;

-- Same pattern as match_challenges: real access to a specific deal's thread is enforced
-- server-side (the handler checks the caller can see the transaction first); RLS here just keeps
-- the table off-limits to anyone who isn't signed in at all.
CREATE POLICY "Signed-in users can read intent messages"
  ON public.intent_messages FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Signed-in users can post an intent message"
  ON public.intent_messages FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND sender_id = auth.uid());

CREATE INDEX IF NOT EXISTS intent_messages_transaction_id_idx ON public.intent_messages(transaction_id);

-- A phone number found for a counterparty, alongside the website/email columns already added —
-- filled in automatically once a candidate is shortlisted.
ALTER TABLE public.counterparties ADD COLUMN IF NOT EXISTS phone text;
