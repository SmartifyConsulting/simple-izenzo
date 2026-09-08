-- AI Suggestion Review Queue (rebuild requirements section 1). Phase-one scope only:
-- human-controlled, admin-only, audit-heavy. AI proposes, a named human approves, nothing fires
-- automatically. Built precisely against the AI Light-Intel V1 UAT failure on a near-identical
-- module (wrong confidence wording, no version history, no client-view-only approval step, no
-- Draft Outreach area) — this pass deliberately omits "convert to outreach draft" entirely, since
-- the spec says that action must be hidden when the outreach draft workflow isn't ready, and this
-- app has no outreach draft workflow at all yet.

CREATE TYPE public.ai_suggestion_type AS ENUM ('suggested_buyer', 'suggested_supplier', 'public_source_research_note');
CREATE TYPE public.ai_suggestion_confidence AS ENUM ('low', 'medium', 'high');
CREATE TYPE public.ai_suggestion_status AS ENUM (
  'new', 'under_review', 'needs_more_research', 'approved', 'rejected', 'archived'
);
CREATE TYPE public.ai_suggestion_rejection_reason AS ENUM (
  'duplicate', 'weak_source', 'wrong_jurisdiction', 'poor_counterparty_fit',
  'compliance_concern', 'insufficient_evidence', 'already_known', 'not_commercially_useful', 'other'
);

CREATE TABLE public.ai_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_type public.ai_suggestion_type NOT NULL,
  related_transaction_id uuid REFERENCES public.transactions ON DELETE CASCADE,
  suggested_name text NOT NULL,
  summary text NOT NULL,
  confidence public.ai_suggestion_confidence NOT NULL,
  source_summary text NOT NULL,
  source_references text,
  source_timestamp timestamptz,
  status public.ai_suggestion_status NOT NULL DEFAULT 'new',
  assigned_reviewer_id uuid,
  reviewer_note text,
  rejection_reason public.ai_suggestion_rejection_reason,
  rejection_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  manual_creation_reason text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Phase one is entirely admin-only, server-side, at the RLS level (not just hidden in the UI).
GRANT SELECT ON public.ai_suggestions TO authenticated;
GRANT ALL ON public.ai_suggestions TO service_role;
ALTER TABLE public.ai_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin only read" ON public.ai_suggestions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
-- No direct INSERT/UPDATE grants at all — every write goes through the RPCs below.

CREATE TABLE public.ai_suggestion_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id uuid NOT NULL REFERENCES public.ai_suggestions ON DELETE CASCADE,
  actor_id uuid NOT NULL DEFAULT auth.uid(),
  event_type text NOT NULL,
  previous_status public.ai_suggestion_status,
  new_status public.ai_suggestion_status,
  note text,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ai_suggestion_events TO authenticated;
GRANT ALL ON public.ai_suggestion_events TO service_role;
ALTER TABLE public.ai_suggestion_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin only read events" ON public.ai_suggestion_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.admin_ai_suggestion_create(
  p_suggestion_type public.ai_suggestion_type,
  p_related_transaction_id uuid,
  p_suggested_name text,
  p_summary text,
  p_confidence public.ai_suggestion_confidence,
  p_source_summary text,
  p_reason text,
  p_source_references text DEFAULT NULL,
  p_source_timestamp timestamptz DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorised to create AI suggestions';
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'A reason is required for manually created suggestions';
  END IF;
  INSERT INTO public.ai_suggestions (
    suggestion_type, related_transaction_id, suggested_name, summary, confidence,
    source_summary, source_references, source_timestamp, manual_creation_reason, created_by
  )
  VALUES (
    p_suggestion_type, p_related_transaction_id, p_suggested_name, p_summary, p_confidence,
    p_source_summary, p_source_references, p_source_timestamp, p_reason, auth.uid()
  )
  RETURNING id INTO v_id;
  INSERT INTO public.ai_suggestion_events (suggestion_id, actor_id, event_type, new_status, reason)
  VALUES (v_id, auth.uid(), 'manual_admin_creation', 'new', p_reason);
  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_ai_suggestion_create(
  public.ai_suggestion_type, uuid, text, text, public.ai_suggestion_confidence, text, text, text, timestamptz
) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_ai_suggestion_set_status(
  p_id uuid,
  p_status public.ai_suggestion_status,
  p_note text DEFAULT NULL,
  p_assigned_reviewer_id uuid DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_prev public.ai_suggestion_status;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorised to update AI suggestions';
  END IF;
  IF p_status = 'needs_more_research' AND (p_note IS NULL OR length(trim(p_note)) = 0) THEN
    RAISE EXCEPTION 'A reviewer note is required for needs_more_research';
  END IF;
  SELECT status INTO v_prev FROM public.ai_suggestions WHERE id = p_id;
  IF v_prev IS NULL THEN
    RAISE EXCEPTION 'Suggestion not found';
  END IF;

  UPDATE public.ai_suggestions
  SET status = p_status,
      reviewer_note = COALESCE(p_note, reviewer_note),
      assigned_reviewer_id = COALESCE(p_assigned_reviewer_id, assigned_reviewer_id),
      updated_at = now()
  WHERE id = p_id;

  INSERT INTO public.ai_suggestion_events (suggestion_id, actor_id, event_type, previous_status, new_status, note)
  VALUES (p_id, auth.uid(), 'status_change', v_prev, p_status, p_note);

  IF p_assigned_reviewer_id IS NOT NULL THEN
    INSERT INTO public.ai_suggestion_events (suggestion_id, actor_id, event_type, note)
    VALUES (p_id, auth.uid(), 'assignment_change', 'assigned to ' || p_assigned_reviewer_id::text);
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_ai_suggestion_set_status(uuid, public.ai_suggestion_status, text, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_ai_suggestion_approve(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_prev public.ai_suggestion_status;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorised to approve AI suggestions';
  END IF;
  SELECT status INTO v_prev FROM public.ai_suggestions WHERE id = p_id;
  UPDATE public.ai_suggestions
  SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
  WHERE id = p_id;
  INSERT INTO public.ai_suggestion_events (suggestion_id, actor_id, event_type, previous_status, new_status)
  VALUES (p_id, auth.uid(), 'approve', v_prev, 'approved');
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_ai_suggestion_approve(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_ai_suggestion_reject(
  p_id uuid,
  p_reason public.ai_suggestion_rejection_reason,
  p_note text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_prev public.ai_suggestion_status;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorised to reject AI suggestions';
  END IF;
  IF p_reason = 'other' AND (p_note IS NULL OR length(trim(p_note)) = 0) THEN
    RAISE EXCEPTION 'A note is required when reason is other';
  END IF;
  SELECT status INTO v_prev FROM public.ai_suggestions WHERE id = p_id;
  UPDATE public.ai_suggestions
  SET status = 'rejected', rejection_reason = p_reason, rejection_note = p_note,
      reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
  WHERE id = p_id;
  INSERT INTO public.ai_suggestion_events (suggestion_id, actor_id, event_type, previous_status, new_status, reason, note)
  VALUES (p_id, auth.uid(), 'reject', v_prev, 'rejected', p_reason::text, p_note);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_ai_suggestion_reject(uuid, public.ai_suggestion_rejection_reason, text) TO authenticated;

CREATE TRIGGER touch_ai_suggestions BEFORE UPDATE ON public.ai_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
