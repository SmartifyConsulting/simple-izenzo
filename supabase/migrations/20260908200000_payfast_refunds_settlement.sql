-- PayFast: Refunds, Settlement & Archiving (rebuild requirements section 5). Recurring theme:
-- "when in doubt, don't move money automatically — raise it for a human." This app has no live
-- PayFast integration (no merchant credentials, no webhook receiver) — this migration builds the
-- governed STATE MACHINE around refunds/settlement/archiving decisions, which is what the spec is
-- actually about (never auto-refund, never auto-credit, always a named admin decision), not a
-- payment gateway integration.
--
-- Explicitly OUT OF SCOPE for this pass (documented, not silently dropped):
--   - Real PayFast API calls (initiate refund, receive ITN webhook, verify signature) — no
--     merchant credentials exist for this project. refund_requests.payfast_reference is a plain
--     text field for whatever reference a human enters after doing this manually/offline today.
--   - Real cold-storage archiving (actually moving data to a different storage tier/provider).
--     archive_move_candidates / archive_moves record the DECISION and its audit trail; no bytes
--     move as a result of this migration, matching the spec's "nothing physically moves without
--     approval" language taken to its logical conclusion — there is no physical mover here yet.

CREATE TYPE public.refund_status AS ENUM (
  'requested', 'approved_for_processing', 'confirmed_complete', 'rejected'
);

CREATE TABLE public.refund_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations ON DELETE CASCADE,
  transaction_id uuid REFERENCES public.transactions ON DELETE SET NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'ZAR',
  reason text NOT NULL,
  status public.refund_status NOT NULL DEFAULT 'requested',
  requested_by uuid NOT NULL DEFAULT auth.uid(),
  approved_by uuid,
  approved_at timestamptz,
  -- Set only once a human (admin, from PayFast's own dashboard/statement, or an eventual real ITN
  -- webhook) confirms funds actually moved — never inferred from the approval step alone.
  confirmed_by uuid,
  confirmed_at timestamptz,
  confirmation_method text,
  payfast_reference text,
  rejected_by uuid,
  rejected_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.refund_requests TO authenticated;
GRANT ALL ON public.refund_requests TO service_role;
ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own org refund requests or admin" ON public.refund_requests FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.refund_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_id uuid NOT NULL REFERENCES public.refund_requests ON DELETE CASCADE,
  actor_id uuid NOT NULL DEFAULT auth.uid(),
  event_type text NOT NULL,
  previous_status public.refund_status,
  new_status public.refund_status,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.refund_events TO authenticated;
GRANT ALL ON public.refund_events TO service_role;
ALTER TABLE public.refund_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "refund events visible same as the refund" ON public.refund_events FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.refund_requests r WHERE r.id = refund_id AND r.org_id = public.current_org_id())
  );

CREATE OR REPLACE FUNCTION public.request_refund(
  p_org_id uuid,
  p_amount numeric,
  p_reason text,
  p_transaction_id uuid DEFAULT NULL,
  p_currency text DEFAULT 'ZAR'
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_org_id <> public.current_org_id() AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Can only request a refund for your own organisation';
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'A reason is required';
  END IF;
  INSERT INTO public.refund_requests (org_id, transaction_id, amount, currency, reason, requested_by)
  VALUES (p_org_id, p_transaction_id, p_amount, p_currency, p_reason, auth.uid())
  RETURNING id INTO v_id;
  INSERT INTO public.refund_events (refund_id, actor_id, event_type, new_status)
  VALUES (v_id, auth.uid(), 'requested', 'requested');
  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.request_refund(uuid, numeric, text, uuid, text) TO authenticated;

-- Interim state: an admin has approved the refund for processing (e.g. initiated it in PayFast's
-- own dashboard) — this is NOT "complete". Nothing here marks money as moved.
CREATE OR REPLACE FUNCTION public.admin_approve_refund_for_processing(p_id uuid, p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorised to approve a refund for processing';
  END IF;
  UPDATE public.refund_requests
  SET status = 'approved_for_processing', approved_by = auth.uid(), approved_at = now(), updated_at = now()
  WHERE id = p_id AND status = 'requested';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Refund not found or not in requested status';
  END IF;
  INSERT INTO public.refund_events (refund_id, actor_id, event_type, previous_status, new_status, note)
  VALUES (p_id, auth.uid(), 'approved_for_processing', 'requested', 'approved_for_processing', p_note);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_approve_refund_for_processing(uuid, text) TO authenticated;

-- The ONLY way a refund becomes "complete": an explicit admin confirmation naming how they know
-- (PayFast dashboard, bank statement, an eventual real ITN webhook) plus their own reference.
-- Never inferred from approval, a timer, or any other state transition.
CREATE OR REPLACE FUNCTION public.admin_confirm_refund_complete(
  p_id uuid,
  p_confirmation_method text,
  p_payfast_reference text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorised to confirm a refund complete';
  END IF;
  IF p_confirmation_method IS NULL OR length(trim(p_confirmation_method)) = 0 THEN
    RAISE EXCEPTION 'A confirmation method is required (e.g. PayFast dashboard, bank statement)';
  END IF;
  UPDATE public.refund_requests
  SET status = 'confirmed_complete', confirmed_by = auth.uid(), confirmed_at = now(),
      confirmation_method = p_confirmation_method, payfast_reference = p_payfast_reference, updated_at = now()
  WHERE id = p_id AND status = 'approved_for_processing';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Refund not found or not in approved_for_processing status';
  END IF;
  INSERT INTO public.refund_events (refund_id, actor_id, event_type, previous_status, new_status, note)
  VALUES (p_id, auth.uid(), 'confirmed_complete', 'approved_for_processing', 'confirmed_complete', p_confirmation_method);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_confirm_refund_complete(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_reject_refund(p_id uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_prev public.refund_status;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorised to reject a refund';
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'A rejection reason is required';
  END IF;
  SELECT status INTO v_prev FROM public.refund_requests WHERE id = p_id;
  IF v_prev = 'confirmed_complete' THEN
    RAISE EXCEPTION 'Cannot reject a refund that is already confirmed complete';
  END IF;
  UPDATE public.refund_requests
  SET status = 'rejected', rejected_by = auth.uid(), rejected_at = now(), rejection_reason = p_reason, updated_at = now()
  WHERE id = p_id;
  INSERT INTO public.refund_events (refund_id, actor_id, event_type, previous_status, new_status, note)
  VALUES (p_id, auth.uid(), 'rejected', v_prev, 'rejected', p_reason);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_reject_refund(uuid, text) TO authenticated;

-- Settlement mismatches: NEVER auto-refund or auto-credit. Every mismatch raises a named item for
-- a human admin decision, preserving whatever evidence is supplied.
CREATE TYPE public.settlement_mismatch_status AS ENUM ('detected', 'under_review', 'resolved');

CREATE TABLE public.settlement_mismatches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  description text NOT NULL,
  izenzo_amount numeric NOT NULL,
  payfast_amount numeric NOT NULL,
  evidence text,
  status public.settlement_mismatch_status NOT NULL DEFAULT 'detected',
  raised_by uuid NOT NULL DEFAULT auth.uid(),
  assigned_to uuid,
  resolution_note text,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.settlement_mismatches TO authenticated;
GRANT ALL ON public.settlement_mismatches TO service_role;
ALTER TABLE public.settlement_mismatches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin only reads settlement mismatches" ON public.settlement_mismatches FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.admin_report_settlement_mismatch(
  p_description text,
  p_izenzo_amount numeric,
  p_payfast_amount numeric,
  p_evidence text DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorised to report a settlement mismatch';
  END IF;
  IF p_description IS NULL OR length(trim(p_description)) = 0 THEN
    RAISE EXCEPTION 'A description of the discrepancy is required';
  END IF;
  INSERT INTO public.settlement_mismatches (description, izenzo_amount, payfast_amount, evidence, raised_by)
  VALUES (p_description, p_izenzo_amount, p_payfast_amount, p_evidence, auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_report_settlement_mismatch(text, numeric, numeric, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_resolve_settlement_mismatch(p_id uuid, p_resolution_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorised to resolve a settlement mismatch';
  END IF;
  IF p_resolution_note IS NULL OR length(trim(p_resolution_note)) = 0 THEN
    RAISE EXCEPTION 'A resolution note is required — never resolve silently';
  END IF;
  UPDATE public.settlement_mismatches
  SET status = 'resolved', resolution_note = p_resolution_note, resolved_by = auth.uid(), resolved_at = now(), updated_at = now()
  WHERE id = p_id AND status <> 'resolved';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mismatch not found or already resolved';
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_resolve_settlement_mismatch(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_mismatch_under_review(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorised to update a settlement mismatch';
  END IF;
  UPDATE public.settlement_mismatches
  SET status = 'under_review', assigned_to = auth.uid(), updated_at = now()
  WHERE id = p_id AND status = 'detected';
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_set_mismatch_under_review(uuid) TO authenticated;

-- Cold-storage archiving: dry-run candidates can be flagged freely; nothing "moves" (there is no
-- physical mover in this app) without an explicit approved_move record naming the approver,
-- retention basis, and retrieval route, per the spec.
CREATE TABLE public.archive_move_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  eligible_reason text NOT NULL,
  flagged_by uuid NOT NULL DEFAULT auth.uid(),
  flagged_at timestamptz NOT NULL DEFAULT now(),
  dismissed_at timestamptz,
  dismissed_by uuid,
  dismiss_reason text
);
GRANT SELECT ON public.archive_move_candidates TO authenticated;
GRANT ALL ON public.archive_move_candidates TO service_role;
ALTER TABLE public.archive_move_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin only reads archive candidates" ON public.archive_move_candidates FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.archive_moves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid REFERENCES public.archive_move_candidates ON DELETE SET NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  records_moved integer NOT NULL DEFAULT 1,
  retention_basis text NOT NULL,
  retrieval_route text NOT NULL,
  approved_by uuid NOT NULL DEFAULT auth.uid(),
  approved_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.archive_moves TO authenticated;
GRANT ALL ON public.archive_moves TO service_role;
ALTER TABLE public.archive_moves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin only reads archive moves" ON public.archive_moves FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.admin_flag_archive_candidate(
  p_entity_type text,
  p_entity_id text,
  p_eligible_reason text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorised to flag an archive candidate';
  END IF;
  INSERT INTO public.archive_move_candidates (entity_type, entity_id, eligible_reason)
  VALUES (p_entity_type, p_entity_id, p_eligible_reason)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_flag_archive_candidate(text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_approve_archive_move(
  p_candidate_id uuid,
  p_retention_basis text,
  p_retrieval_route text,
  p_records_moved integer DEFAULT 1
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_candidate record;
  v_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorised to approve an archive move';
  END IF;
  IF p_retention_basis IS NULL OR length(trim(p_retention_basis)) = 0 THEN
    RAISE EXCEPTION 'A retention basis is required';
  END IF;
  IF p_retrieval_route IS NULL OR length(trim(p_retrieval_route)) = 0 THEN
    RAISE EXCEPTION 'A retrieval route is required';
  END IF;
  SELECT * INTO v_candidate FROM public.archive_move_candidates WHERE id = p_candidate_id AND dismissed_at IS NULL;
  IF v_candidate.id IS NULL THEN
    RAISE EXCEPTION 'Candidate not found or already dismissed';
  END IF;
  INSERT INTO public.archive_moves (
    candidate_id, entity_type, entity_id, records_moved, retention_basis, retrieval_route, approved_by
  )
  VALUES (
    p_candidate_id, v_candidate.entity_type, v_candidate.entity_id, p_records_moved, p_retention_basis, p_retrieval_route, auth.uid()
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_approve_archive_move(uuid, text, text, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_dismiss_archive_candidate(p_id uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorised to dismiss an archive candidate';
  END IF;
  UPDATE public.archive_move_candidates
  SET dismissed_at = now(), dismissed_by = auth.uid(), dismiss_reason = p_reason
  WHERE id = p_id AND dismissed_at IS NULL;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_dismiss_archive_candidate(uuid, text) TO authenticated;

CREATE TRIGGER touch_refund_requests BEFORE UPDATE ON public.refund_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_settlement_mismatches BEFORE UPDATE ON public.settlement_mismatches
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
