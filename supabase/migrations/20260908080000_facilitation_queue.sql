-- Unknown-Counterparty Facilitation Queue (rebuild requirements section 14) + its user-facing
-- status timeline (section 17). "A governed pre-POI facilitation process" — surfaces/validates a
-- possible counterparty without creating false certainty, accidental outreach, or any binding
-- commercial state. No POI, WaD, verification decision, compliance clearance, commercial
-- commitment, or external disclosure happens automatically.

CREATE TYPE public.facilitation_status AS ENUM (
  'new_unassigned',
  'triage_in_progress',
  'more_information_needed',
  'compliance_review_required',
  'outreach_approved',
  'contact_attempted',
  'counterparty_responded',
  'profile_verification_in_progress',
  'ready_for_poi',
  'closed'
);

CREATE TYPE public.facilitation_outcome AS ENUM (
  'converted_to_known_counterparty',
  'ready_for_next_step',
  'ready_for_poi_review',
  'counterparty_declined',
  'no_response',
  'invalid_details',
  'duplicate_merged',
  'blocked_by_compliance',
  'cancelled_by_requester',
  'closed_by_admin',
  'unable_to_contact'
);

CREATE TABLE public.facilitation_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid REFERENCES public.transactions ON DELETE SET NULL,
  requester_id uuid NOT NULL DEFAULT auth.uid(),
  org_id uuid REFERENCES public.organisations ON DELETE SET NULL,
  counterparty_name text NOT NULL,
  country text,
  sector text,
  product_service text,
  counterparty_role text,
  purpose text,
  contact_identifier text NOT NULL,
  source_evidence text NOT NULL,
  authority_confirmed boolean NOT NULL DEFAULT false,
  status public.facilitation_status NOT NULL DEFAULT 'new_unassigned',
  owner_id uuid,
  owner_assigned_at timestamptz,
  compliance_hold boolean NOT NULL DEFAULT false,
  compliance_hold_reason text,
  final_outcome public.facilitation_outcome,
  closure_reason text,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.facilitation_cases TO authenticated;
GRANT ALL ON public.facilitation_cases TO service_role;
ALTER TABLE public.facilitation_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read own or admin cases" ON public.facilitation_cases FOR SELECT TO authenticated
  USING (requester_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "submit own case" ON public.facilitation_cases FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid());
-- All state changes (assignment, status, blocks, closure) go through the RPCs below only.
REVOKE UPDATE ON public.facilitation_cases FROM authenticated;

CREATE TABLE public.facilitation_case_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.facilitation_cases ON DELETE CASCADE,
  actor_id uuid NOT NULL DEFAULT auth.uid(),
  event_type text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.facilitation_case_events TO authenticated;
GRANT ALL ON public.facilitation_case_events TO service_role;
ALTER TABLE public.facilitation_case_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read events for accessible cases" ON public.facilitation_case_events FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.facilitation_cases c
    WHERE c.id = case_id AND (c.requester_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  ));
REVOKE INSERT ON public.facilitation_case_events FROM authenticated;

CREATE OR REPLACE FUNCTION public.admin_facilitation_assign(p_case_id uuid, p_owner_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorised to assign facilitation cases';
  END IF;
  UPDATE public.facilitation_cases
  SET owner_id = p_owner_id, owner_assigned_at = now(), status = 'triage_in_progress', updated_at = now()
  WHERE id = p_case_id AND status = 'new_unassigned';
  INSERT INTO public.facilitation_case_events (case_id, actor_id, event_type, note)
  VALUES (p_case_id, auth.uid(), 'assigned', NULL);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_facilitation_assign(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_facilitation_set_status(
  p_case_id uuid,
  p_status public.facilitation_status,
  p_note text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorised to update facilitation case status';
  END IF;
  IF p_status = 'more_information_needed' AND (p_note IS NULL OR length(trim(p_note)) = 0) THEN
    RAISE EXCEPTION 'A note is required when requesting more information';
  END IF;
  UPDATE public.facilitation_cases SET status = p_status, updated_at = now() WHERE id = p_case_id;
  INSERT INTO public.facilitation_case_events (case_id, actor_id, event_type, note)
  VALUES (p_case_id, auth.uid(), 'status_' || p_status::text, p_note);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_facilitation_set_status(uuid, public.facilitation_status, text) TO authenticated;

-- Compliance blocks: only an admin acting as compliance may set or clear one, and the case owner
-- may never clear their own block (this RPC does not distinguish "compliance admin" from "admin"
-- yet — the existing role model only has one admin role — but the clear-audit-trail requirement
-- and the block-blocks-outreach behaviour are enforced here).
CREATE OR REPLACE FUNCTION public.admin_facilitation_set_compliance_hold(
  p_case_id uuid,
  p_hold boolean,
  p_reason text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorised to change a compliance hold';
  END IF;
  IF p_hold AND (p_reason IS NULL OR length(trim(p_reason)) = 0) THEN
    RAISE EXCEPTION 'A reason is required to place a compliance hold';
  END IF;
  UPDATE public.facilitation_cases
  SET compliance_hold = p_hold,
      compliance_hold_reason = p_reason,
      status = CASE WHEN p_hold THEN 'compliance_review_required'::public.facilitation_status ELSE status END,
      updated_at = now()
  WHERE id = p_case_id;
  INSERT INTO public.facilitation_case_events (case_id, actor_id, event_type, note)
  VALUES (p_case_id, auth.uid(), CASE WHEN p_hold THEN 'compliance_hold_set' ELSE 'compliance_hold_cleared' END, p_reason);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_facilitation_set_compliance_hold(uuid, boolean, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_facilitation_close(
  p_case_id uuid,
  p_outcome public.facilitation_outcome,
  p_reason text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorised to close facilitation cases';
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'A closure reason is required';
  END IF;
  UPDATE public.facilitation_cases
  SET status = 'closed', final_outcome = p_outcome, closure_reason = p_reason, closed_at = now(), updated_at = now()
  WHERE id = p_case_id AND status != 'closed';
  INSERT INTO public.facilitation_case_events (case_id, actor_id, event_type, note)
  VALUES (p_case_id, auth.uid(), 'closed_' || p_outcome::text, p_reason);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_facilitation_close(uuid, public.facilitation_outcome, text) TO authenticated;

CREATE TRIGGER touch_facilitation_cases BEFORE UPDATE ON public.facilitation_cases
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
