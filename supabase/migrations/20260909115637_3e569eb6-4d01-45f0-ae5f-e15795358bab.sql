CREATE TYPE public.identity_check_type AS ENUM ('id_document', 'kyb', 'aml');
CREATE TYPE public.identity_check_status AS ENUM ('pending', 'in_progress', 'passed', 'review', 'failed', 'expired');

CREATE TABLE public.identity_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_type public.identity_check_type NOT NULL,
  subject_user_id uuid,
  subject_org_id uuid REFERENCES public.organisations(id),
  subject_counterparty_id uuid REFERENCES public.counterparties(id),
  transaction_id uuid REFERENCES public.transactions(id),
  subject_label text,
  provider text NOT NULL DEFAULT 'didit',
  provider_session_id text,
  provider_url text,
  status public.identity_check_status NOT NULL DEFAULT 'pending',
  decision text,
  reason text,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.identity_verifications TO authenticated;
GRANT ALL ON public.identity_verifications TO service_role;

ALTER TABLE public.identity_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read own or org verifications"
  ON public.identity_verifications FOR SELECT TO authenticated
  USING (
    subject_user_id = auth.uid()
    OR (subject_org_id IS NOT NULL AND subject_org_id = public.current_org_id())
    OR (transaction_id IS NOT NULL AND public.can_access_tx(transaction_id))
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE INDEX idx_identity_verifications_tx ON public.identity_verifications(transaction_id);
CREATE INDEX idx_identity_verifications_user ON public.identity_verifications(subject_user_id);
CREATE INDEX idx_identity_verifications_session ON public.identity_verifications(provider_session_id);

CREATE TRIGGER touch_identity_verifications
  BEFORE UPDATE ON public.identity_verifications
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();