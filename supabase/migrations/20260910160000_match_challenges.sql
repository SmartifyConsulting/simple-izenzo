-- Lets either side (or a platform administrator) raise a challenge on a match to pause its
-- progression while a concern is resolved. Visible to both parties and admins on the deal.
CREATE TABLE IF NOT EXISTS public.match_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  counterparty_id uuid REFERENCES public.counterparties(id) ON DELETE SET NULL,
  subject text NOT NULL,
  summary text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  raised_by uuid NOT NULL,
  raised_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolution_note text
);

ALTER TABLE public.match_challenges ENABLE ROW LEVEL SECURITY;

-- Access to a specific deal's challenges is actually enforced server-side (the server fn checks
-- the caller can see the transaction before it reads or writes anything here) — same pattern
-- already used for background screening and the AI document summary. RLS here just keeps the
-- table off-limits to anyone who isn't signed in at all.
CREATE POLICY "Signed-in users can read match challenges"
  ON public.match_challenges FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Signed-in users can raise a match challenge"
  ON public.match_challenges FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND raised_by = auth.uid());

CREATE INDEX IF NOT EXISTS match_challenges_transaction_id_idx ON public.match_challenges(transaction_id);
