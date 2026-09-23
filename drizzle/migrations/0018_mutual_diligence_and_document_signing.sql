-- Mutual (two-way) KYC/KYB diligence between the bidder and the chosen counterparty,
-- the counterparty/bidder engagement response (accept, challenge, opt out), and dual
-- digital signatures on shared business documents.

CREATE TABLE public.engagement_diligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  -- Which side is running the checks on the other side.
  reviewer_side TEXT NOT NULL CHECK (reviewer_side IN ('bidder','counterparty')),
  kyc_state TEXT NOT NULL DEFAULT 'pending' CHECK (kyc_state IN ('pending','passed','failed','waived')),
  kyb_state TEXT NOT NULL DEFAULT 'pending' CHECK (kyb_state IN ('pending','passed','failed','waived')),
  kyc_waiver_reason TEXT,
  kyb_waiver_reason TEXT,
  cleared_at TIMESTAMPTZ,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (transaction_id, reviewer_side)
);

GRANT SELECT, INSERT, UPDATE ON public.engagement_diligence TO authenticated;
GRANT ALL ON public.engagement_diligence TO service_role;

ALTER TABLE public.engagement_diligence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parties read diligence on their deal"
  ON public.engagement_diligence FOR SELECT TO authenticated
  USING (public.can_access_tx(transaction_id));

CREATE POLICY "Parties record diligence on their deal"
  ON public.engagement_diligence FOR INSERT TO authenticated
  WITH CHECK (public.can_access_tx(transaction_id));

CREATE POLICY "Parties update diligence on their deal"
  ON public.engagement_diligence FOR UPDATE TO authenticated
  USING (public.can_access_tx(transaction_id))
  WITH CHECK (public.can_access_tx(transaction_id));

CREATE TRIGGER engagement_diligence_touch
  BEFORE UPDATE ON public.engagement_diligence
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Append-only: every accept / challenge / opt-out is its own attributed, timestamped record.
CREATE TABLE public.engagement_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  responder_user_id UUID NOT NULL DEFAULT auth.uid(),
  responder_name TEXT,
  responder_side TEXT NOT NULL CHECK (responder_side IN ('bidder','counterparty')),
  response TEXT NOT NULL CHECK (response IN ('accepted','challenged','opted_out')),
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX engagement_responses_tx_idx ON public.engagement_responses (transaction_id, created_at DESC);

GRANT SELECT, INSERT ON public.engagement_responses TO authenticated;
GRANT ALL ON public.engagement_responses TO service_role;

ALTER TABLE public.engagement_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parties read engagement responses on their deal"
  ON public.engagement_responses FOR SELECT TO authenticated
  USING (public.can_access_tx(transaction_id));

CREATE POLICY "Parties record their own engagement response"
  ON public.engagement_responses FOR INSERT TO authenticated
  WITH CHECK (public.can_access_tx(transaction_id) AND responder_user_id = auth.uid());

-- Dual digital signatures against one shared document record.
CREATE TABLE public.document_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  signer_user_id UUID NOT NULL DEFAULT auth.uid(),
  signer_name TEXT NOT NULL,
  signer_side TEXT NOT NULL CHECK (signer_side IN ('bidder','counterparty')),
  signed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, signer_user_id)
);

CREATE INDEX document_signatures_document_idx ON public.document_signatures (document_id);

GRANT SELECT, INSERT ON public.document_signatures TO authenticated;
GRANT ALL ON public.document_signatures TO service_role;

ALTER TABLE public.document_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parties read signatures on their deal"
  ON public.document_signatures FOR SELECT TO authenticated
  USING (public.can_access_tx(transaction_id));

CREATE POLICY "Parties sign as themselves"
  ON public.document_signatures FOR INSERT TO authenticated
  WITH CHECK (public.can_access_tx(transaction_id) AND signer_user_id = auth.uid());

-- Signature state on the shared document itself.
ALTER TABLE public.documents ADD COLUMN requires_signature BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.documents ADD COLUMN fully_signed_at TIMESTAMPTZ;
ALTER TABLE public.documents ADD COLUMN signed_pdf_path TEXT;
ALTER TABLE public.documents ADD COLUMN signed_pdf_name TEXT;