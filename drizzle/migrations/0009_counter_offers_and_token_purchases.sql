CREATE TABLE public.counter_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  counterparty_id uuid NOT NULL REFERENCES public.counterparties(id) ON DELETE CASCADE,
  direction text NOT NULL DEFAULT 'from_bidder' CHECK (direction IN ('from_bidder','from_counterparty')),
  price numeric,
  quantity numeric,
  unit text,
  currency text,
  terms text NOT NULL,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','answered','accepted','withdrawn')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.counter_offers TO authenticated;
GRANT ALL ON public.counter_offers TO service_role;

ALTER TABLE public.counter_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deal participants read counter offers"
  ON public.counter_offers FOR SELECT TO authenticated
  USING (public.can_access_tx(transaction_id));

CREATE POLICY "Deal participants create counter offers"
  ON public.counter_offers FOR INSERT TO authenticated
  WITH CHECK (public.can_access_tx(transaction_id));

CREATE POLICY "Deal participants update counter offers"
  ON public.counter_offers FOR UPDATE TO authenticated
  USING (public.can_access_tx(transaction_id));

CREATE INDEX counter_offers_tx_idx ON public.counter_offers (transaction_id, created_at DESC);

CREATE TABLE public.token_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  m_payment_id text NOT NULL UNIQUE,
  pf_payment_id text,
  tokens integer NOT NULL,
  amount_zar numeric NOT NULL,
  amount_usd numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','complete','failed','cancelled')),
  credited_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.token_purchases TO authenticated;
GRANT ALL ON public.token_purchases TO service_role;

ALTER TABLE public.token_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own org reads token purchases"
  ON public.token_purchases FOR SELECT TO authenticated
  USING (org_id = public.current_org_id());
