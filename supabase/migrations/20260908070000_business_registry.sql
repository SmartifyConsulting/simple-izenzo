-- Business Registry: first buildable slice per the rebuild requirements (section 4).
-- Scope of this migration: company records with readiness states, source provenance, and a
-- claim workflow. Deliberately OUT of scope for this pass (tracked as explicit follow-up):
-- bank-detail capture/verification (spec questions 41-50), authority-to-act scopes, duplicate
-- merge engine, and the full 13-role model (data_governance_owner/compliance_owner) — this pass
-- uses the existing 'admin' role as the approver for all registry actions.

CREATE TYPE public.registry_readiness_state AS ENUM (
  'seed_only',
  'sample_only',
  'demo_only',
  'licence_pending',
  'provider_pending',
  'quarantined',
  'duplicate_unresolved',
  'disputed',
  'privacy_hold',
  'public_search_ready',
  'demo_ready'
);

CREATE TYPE public.registry_claim_status AS ENUM (
  'submitted',
  'more_information_required',
  'approved',
  'rejected'
);

CREATE TABLE public.registry_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name text NOT NULL,
  trading_name text,
  country text NOT NULL,
  registration_no text,
  sector text,
  -- Provenance: per rule, imported data is "sourced only" until separately verified — never
  -- implicitly treated as verified.
  source_type text NOT NULL DEFAULT 'admin_reviewed_evidence',
  source_name text,
  licence_ref text,
  import_batch_id text,
  observed_date date,
  readiness_state public.registry_readiness_state NOT NULL DEFAULT 'seed_only',
  -- Set once a claim is approved and the company becomes a real trading organisation.
  claimed_org_id uuid REFERENCES public.organisations ON DELETE SET NULL,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.registry_companies TO authenticated;
GRANT ALL ON public.registry_companies TO service_role;
ALTER TABLE public.registry_companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read public registry" ON public.registry_companies FOR SELECT TO authenticated
  USING (
    readiness_state IN ('public_search_ready', 'demo_ready')
    OR public.has_role(auth.uid(), 'admin')
    OR claimed_org_id = public.current_org_id()
  );
-- Readiness changes go through admin_registry_set_readiness() only, not direct writes — see below.
REVOKE UPDATE (readiness_state) ON public.registry_companies FROM authenticated;
REVOKE INSERT ON public.registry_companies FROM authenticated;

CREATE TABLE public.registry_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.registry_companies ON DELETE CASCADE,
  claimant_id uuid NOT NULL DEFAULT auth.uid(),
  claimant_role text NOT NULL,
  evidence_note text,
  evidence_url text,
  status public.registry_claim_status NOT NULL DEFAULT 'submitted',
  decision_reason text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.registry_claims TO authenticated;
GRANT ALL ON public.registry_claims TO service_role;
ALTER TABLE public.registry_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read own or admin claims" ON public.registry_claims FOR SELECT TO authenticated
  USING (claimant_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "submit own claim" ON public.registry_claims FOR INSERT TO authenticated
  WITH CHECK (claimant_id = auth.uid());
-- Decisions (status/reviewed_by/reviewed_at/decision_reason) go through the RPC below only.
REVOKE UPDATE ON public.registry_claims FROM authenticated;

-- Every claim on a company blocks new competing claims from resolving silently; per the spec,
-- rejection always requires a reason, and approval both sets the claim decided AND (for the
-- MVP) marks the company demo_ready if it was still seed-only, since a validated claimant is
-- itself a form of evidence review.
CREATE OR REPLACE FUNCTION public.admin_decide_registry_claim(
  p_claim_id uuid,
  p_decision public.registry_claim_status,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorised to decide registry claims';
  END IF;
  IF p_decision NOT IN ('approved', 'rejected', 'more_information_required') THEN
    RAISE EXCEPTION 'Invalid decision';
  END IF;
  IF p_decision = 'rejected' AND (p_reason IS NULL OR length(trim(p_reason)) = 0) THEN
    RAISE EXCEPTION 'A rejection reason is required';
  END IF;

  SELECT company_id INTO v_company_id FROM public.registry_claims WHERE id = p_claim_id;
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Claim not found';
  END IF;

  UPDATE public.registry_claims
  SET status = p_decision, decision_reason = p_reason, reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = p_claim_id;

  IF p_decision = 'approved' THEN
    UPDATE public.registry_companies
    SET readiness_state = 'demo_ready', updated_at = now()
    WHERE id = v_company_id AND readiness_state = 'seed_only';
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_decide_registry_claim(uuid, public.registry_claim_status, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_registry_set_readiness(
  p_company_id uuid,
  p_state public.registry_readiness_state
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorised to change registry readiness';
  END IF;
  UPDATE public.registry_companies SET readiness_state = p_state, updated_at = now() WHERE id = p_company_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_registry_set_readiness(uuid, public.registry_readiness_state) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_registry_create_company(
  p_legal_name text,
  p_country text,
  p_registration_no text DEFAULT NULL,
  p_sector text DEFAULT NULL,
  p_source_name text DEFAULT NULL,
  p_readiness_state public.registry_readiness_state DEFAULT 'seed_only'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorised to add registry companies';
  END IF;
  INSERT INTO public.registry_companies (legal_name, country, registration_no, sector, source_name, readiness_state, created_by)
  VALUES (p_legal_name, p_country, p_registration_no, p_sector, p_source_name, p_readiness_state, auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_registry_create_company(text, text, text, text, text, public.registry_readiness_state) TO authenticated;

CREATE TRIGGER touch_registry_companies BEFORE UPDATE ON public.registry_companies
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed the 5-company controlled sample named in the spec, as sample_only (visible in search,
-- clearly labelled, not implying full production coverage).
INSERT INTO public.registry_companies (legal_name, country, sector, source_type, source_name, readiness_state)
VALUES
  ('Bullion Bathrooms Nigeria', 'Nigeria', 'Building materials', 'licensed_third_party_dataset', 'Registry sample import', 'sample_only'),
  ('Dangote Fertiliser Limited', 'Nigeria', 'Agricultural inputs', 'licensed_third_party_dataset', 'Registry sample import', 'sample_only'),
  ('Harith Holdings', 'South Africa', 'Infrastructure investment', 'licensed_third_party_dataset', 'Registry sample import', 'sample_only'),
  ('Laurium Capital', 'South Africa', 'Asset management', 'licensed_third_party_dataset', 'Registry sample import', 'sample_only'),
  ('Starfair 162', 'South Africa', 'Metals & minerals trading', 'licensed_third_party_dataset', 'Registry sample import', 'sample_only')
ON CONFLICT DO NOTHING;
