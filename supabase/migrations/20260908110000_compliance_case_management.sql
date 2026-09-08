-- Compliance Case Management (rebuild requirements section 19 UAT finding + Phase 4).
-- The real platform has 3 parallel case tables and no unified case object, no DB-level
-- maker-checker, no case PDF export. This rebuild deliberately designs ONE unified case object
-- from day one instead of reproducing that mistake, and enforces maker-checker at the RLS/RPC
-- level (the checker cannot be the same admin who proposed the decision — enforced in SQL, not
-- just hidden in the UI).
--
-- Explicitly OUT OF SCOPE for this first slice (documented here, not silently dropped):
--   - Customer submission portal (cases are admin-created only for now; a public intake form is
--     a separate follow-up once the trust/consent rules for customer-initiated cases are decided).
--   - Case PDF / signed evidence-pack export. The known gap in the real platform is that this
--     action records intent and returns a UUID with no actual PDF — we are not repeating that
--     stub-as-if-done pattern, so instead of building a fake button, PDF export is left for a
--     dedicated follow-up phase (it needs a real Storage + signing pipeline, same as the Funder
--     Workspace evidence pack in Phase 5, and should likely be built once alongside it).

CREATE TYPE public.compliance_case_type AS ENUM (
  'kyc_review', 'aml_alert', 'counterparty_dispute', 'transaction_review', 'other'
);
CREATE TYPE public.compliance_case_status AS ENUM (
  'open', 'under_review', 'decision_proposed', 'closed_approved', 'closed_rejected', 'closed_no_action'
);
CREATE TYPE public.compliance_case_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE public.compliance_case_decision AS ENUM ('approve', 'reject', 'no_action');

CREATE TABLE public.compliance_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_type public.compliance_case_type NOT NULL,
  priority public.compliance_case_priority NOT NULL DEFAULT 'medium',
  status public.compliance_case_status NOT NULL DEFAULT 'open',
  subject_counterparty_id uuid REFERENCES public.counterparties ON DELETE SET NULL,
  subject_transaction_id uuid REFERENCES public.transactions ON DELETE SET NULL,
  subject_org_id uuid REFERENCES public.organisations ON DELETE SET NULL,
  title text NOT NULL,
  summary text NOT NULL,
  assigned_analyst_id uuid,
  proposed_decision public.compliance_case_decision,
  proposed_decision_note text,
  proposed_decision_by uuid,
  proposed_decision_at timestamptz,
  final_decision public.compliance_case_decision,
  final_decision_note text,
  decided_by uuid,
  decided_at timestamptz,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT compliance_case_has_subject CHECK (
    subject_counterparty_id IS NOT NULL OR subject_transaction_id IS NOT NULL OR subject_org_id IS NOT NULL
  )
);
GRANT SELECT ON public.compliance_cases TO authenticated;
GRANT ALL ON public.compliance_cases TO service_role;
ALTER TABLE public.compliance_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin only read cases" ON public.compliance_cases FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
-- No direct INSERT/UPDATE grants — every write, including the decision itself, goes through the
-- RPCs below so the maker-checker rule can be enforced in one place.

CREATE TABLE public.compliance_case_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.compliance_cases ON DELETE CASCADE,
  actor_id uuid NOT NULL DEFAULT auth.uid(),
  event_type text NOT NULL,
  previous_status public.compliance_case_status,
  new_status public.compliance_case_status,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.compliance_case_events TO authenticated;
GRANT ALL ON public.compliance_case_events TO service_role;
ALTER TABLE public.compliance_case_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin only read case events" ON public.compliance_case_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.admin_case_create(
  p_case_type public.compliance_case_type,
  p_title text,
  p_summary text,
  p_priority public.compliance_case_priority DEFAULT 'medium',
  p_subject_counterparty_id uuid DEFAULT NULL,
  p_subject_transaction_id uuid DEFAULT NULL,
  p_subject_org_id uuid DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorised to create compliance cases';
  END IF;
  IF p_subject_counterparty_id IS NULL AND p_subject_transaction_id IS NULL AND p_subject_org_id IS NULL THEN
    RAISE EXCEPTION 'A case must reference at least one subject';
  END IF;
  INSERT INTO public.compliance_cases (
    case_type, title, summary, priority,
    subject_counterparty_id, subject_transaction_id, subject_org_id, created_by
  )
  VALUES (
    p_case_type, p_title, p_summary, p_priority,
    p_subject_counterparty_id, p_subject_transaction_id, p_subject_org_id, auth.uid()
  )
  RETURNING id INTO v_id;
  INSERT INTO public.compliance_case_events (case_id, actor_id, event_type, new_status)
  VALUES (v_id, auth.uid(), 'case_created', 'open');
  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_case_create(
  public.compliance_case_type, text, text, public.compliance_case_priority, uuid, uuid, uuid
) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_case_assign(p_id uuid, p_analyst_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_prev public.compliance_case_status;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorised to assign compliance cases';
  END IF;
  SELECT status INTO v_prev FROM public.compliance_cases WHERE id = p_id;
  IF v_prev IS NULL THEN
    RAISE EXCEPTION 'Case not found';
  END IF;
  UPDATE public.compliance_cases
  SET assigned_analyst_id = p_analyst_id,
      status = CASE WHEN status = 'open' THEN 'under_review'::public.compliance_case_status ELSE status END,
      updated_at = now()
  WHERE id = p_id;
  INSERT INTO public.compliance_case_events (case_id, actor_id, event_type, previous_status, new_status, note)
  VALUES (p_id, auth.uid(), 'assignment_change', v_prev, 'under_review', 'assigned to ' || p_analyst_id::text);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_case_assign(uuid, uuid) TO authenticated;

-- MAKER step: the assigned analyst (or any admin) proposes a decision. This does not close the
-- case — it only records intent and moves status to decision_proposed, awaiting a different admin.
CREATE OR REPLACE FUNCTION public.admin_case_propose_decision(
  p_id uuid,
  p_decision public.compliance_case_decision,
  p_note text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_prev public.compliance_case_status;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorised to propose a compliance case decision';
  END IF;
  IF p_note IS NULL OR length(trim(p_note)) = 0 THEN
    RAISE EXCEPTION 'A note is required when proposing a decision';
  END IF;
  SELECT status INTO v_prev FROM public.compliance_cases WHERE id = p_id;
  IF v_prev IS NULL THEN
    RAISE EXCEPTION 'Case not found';
  END IF;
  IF v_prev IN ('closed_approved', 'closed_rejected', 'closed_no_action') THEN
    RAISE EXCEPTION 'Case is already closed';
  END IF;
  UPDATE public.compliance_cases
  SET status = 'decision_proposed',
      proposed_decision = p_decision,
      proposed_decision_note = p_note,
      proposed_decision_by = auth.uid(),
      proposed_decision_at = now(),
      updated_at = now()
  WHERE id = p_id;
  INSERT INTO public.compliance_case_events (case_id, actor_id, event_type, previous_status, new_status, note)
  VALUES (p_id, auth.uid(), 'decision_proposed', v_prev, 'decision_proposed', p_note);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_case_propose_decision(uuid, public.compliance_case_decision, text) TO authenticated;

-- CHECKER step: a different admin approves or rejects the proposed decision. Enforced in SQL:
-- the checker's auth.uid() must not equal proposed_decision_by, so this cannot be bypassed by a
-- client that simply hides the button for the proposer.
CREATE OR REPLACE FUNCTION public.admin_case_approve_decision(p_id uuid, p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_case record;
  v_final_status public.compliance_case_status;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorised to approve a compliance case decision';
  END IF;
  SELECT * INTO v_case FROM public.compliance_cases WHERE id = p_id;
  IF v_case.id IS NULL THEN
    RAISE EXCEPTION 'Case not found';
  END IF;
  IF v_case.status <> 'decision_proposed' THEN
    RAISE EXCEPTION 'Case has no pending proposed decision';
  END IF;
  IF v_case.proposed_decision_by = auth.uid() THEN
    RAISE EXCEPTION 'Maker-checker violation: the proposing admin cannot also approve the decision';
  END IF;

  v_final_status := CASE v_case.proposed_decision
    WHEN 'approve' THEN 'closed_approved'::public.compliance_case_status
    WHEN 'reject' THEN 'closed_rejected'::public.compliance_case_status
    ELSE 'closed_no_action'::public.compliance_case_status
  END;

  UPDATE public.compliance_cases
  SET status = v_final_status,
      final_decision = proposed_decision,
      final_decision_note = COALESCE(p_note, proposed_decision_note),
      decided_by = auth.uid(),
      decided_at = now(),
      updated_at = now()
  WHERE id = p_id;

  INSERT INTO public.compliance_case_events (case_id, actor_id, event_type, previous_status, new_status, note)
  VALUES (p_id, auth.uid(), 'decision_approved', 'decision_proposed', v_final_status, p_note);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_case_approve_decision(uuid, text) TO authenticated;

-- Checker can also send a proposed decision back for rework instead of approving it.
CREATE OR REPLACE FUNCTION public.admin_case_reject_proposal(p_id uuid, p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_case record;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorised to send back a compliance case proposal';
  END IF;
  IF p_note IS NULL OR length(trim(p_note)) = 0 THEN
    RAISE EXCEPTION 'A note is required when sending a proposal back';
  END IF;
  SELECT * INTO v_case FROM public.compliance_cases WHERE id = p_id;
  IF v_case.id IS NULL THEN
    RAISE EXCEPTION 'Case not found';
  END IF;
  IF v_case.status <> 'decision_proposed' THEN
    RAISE EXCEPTION 'Case has no pending proposed decision';
  END IF;
  IF v_case.proposed_decision_by = auth.uid() THEN
    RAISE EXCEPTION 'Maker-checker violation: the proposing admin cannot also review their own proposal';
  END IF;

  UPDATE public.compliance_cases
  SET status = 'under_review',
      proposed_decision = NULL,
      proposed_decision_note = NULL,
      proposed_decision_by = NULL,
      proposed_decision_at = NULL,
      updated_at = now()
  WHERE id = p_id;

  INSERT INTO public.compliance_case_events (case_id, actor_id, event_type, previous_status, new_status, note)
  VALUES (p_id, auth.uid(), 'proposal_sent_back', 'decision_proposed', 'under_review', p_note);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_case_reject_proposal(uuid, text) TO authenticated;

CREATE TRIGGER touch_compliance_cases BEFORE UPDATE ON public.compliance_cases
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
