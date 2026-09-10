CREATE TABLE public.match_challenges (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  counterparty_id uuid REFERENCES public.counterparties(id) ON DELETE SET NULL,
  subject text NOT NULL,
  summary text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  raised_by uuid NOT NULL,
  raised_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_match_challenges_tx ON public.match_challenges(transaction_id);

GRANT SELECT, INSERT, UPDATE ON public.match_challenges TO authenticated;
GRANT ALL ON public.match_challenges TO service_role;

ALTER TABLE public.match_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View challenges on accessible deals"
  ON public.match_challenges FOR SELECT TO authenticated
  USING (public.can_access_tx(transaction_id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Raise challenges on accessible deals"
  ON public.match_challenges FOR INSERT TO authenticated
  WITH CHECK (public.can_access_tx(transaction_id) AND raised_by = auth.uid());

CREATE POLICY "Update challenges on accessible deals"
  ON public.match_challenges FOR UPDATE TO authenticated
  USING (public.can_access_tx(transaction_id) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.can_access_tx(transaction_id) OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_match_challenges_updated_at
  BEFORE UPDATE ON public.match_challenges
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();