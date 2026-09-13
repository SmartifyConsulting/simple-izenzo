CREATE TABLE public.intent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX intent_messages_tx_created_idx ON public.intent_messages (transaction_id, created_at);

GRANT SELECT, INSERT ON public.intent_messages TO authenticated;
GRANT ALL ON public.intent_messages TO service_role;

ALTER TABLE public.intent_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deal participants can read intent messages"
  ON public.intent_messages FOR SELECT TO authenticated
  USING (public.can_access_tx(transaction_id));

CREATE POLICY "Deal participants can post intent messages"
  ON public.intent_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.can_access_tx(transaction_id));