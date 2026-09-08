-- Enterprise Support, Ticketing & Incident Management (rebuild requirements section 7 — Phase 7)
-- plus the SMS/WhatsApp Notification Readiness shell (section 13), built together since the
-- readiness shell's "skip audit" pattern is used by this module (a ticket escalation is exactly
-- the kind of event that would notify by SMS/WhatsApp once those channels are approved).
--
-- Core-launch acceptance gate this migration targets: every approved authenticated role can submit
-- a ticket; org isolation is enforced by RLS; customer + internal message threads both work with
-- internal notes PERMANENTLY separated from customer-visible replies (no toggle, no admin override
-- that could leak one into the other — separate rows, separate RLS policy); assignment/escalation
-- work; SLA clocks + breach detection work; audit history works.
--
-- Explicitly OUT OF SCOPE for this pass (documented, not silently dropped, per the spec's own
-- deferral list): attachments (needs malware scanning first), inbound/reply-by-email, automated
-- GitHub release-linkage integration (this migration adds a plain text `related_release` field
-- instead of a real integration), public status page + subscribers, full knowledge base, scheduled
-- enterprise reporting packs. Live SMS/WhatsApp sending, provider credentials, templates, webhooks
-- and delivery retries remain explicitly out of scope until separately approved — this migration
-- only builds the readiness shell (channels shown as Not Configured, sends always fall back,
-- skips are audited), never live sending.

CREATE TYPE public.support_ticket_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE public.support_ticket_status AS ENUM (
  'open', 'in_progress', 'waiting_on_customer', 'escalated', 'resolved', 'closed'
);

CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations ON DELETE CASCADE,
  requester_id uuid NOT NULL DEFAULT auth.uid(),
  subject text NOT NULL,
  priority public.support_ticket_priority NOT NULL DEFAULT 'medium',
  status public.support_ticket_status NOT NULL DEFAULT 'open',
  assigned_agent_id uuid,
  related_release text,
  sla_due_at timestamptz NOT NULL,
  resolved_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Customer isolation: a requester's own org only. Support staff see every ticket.
CREATE POLICY "own org tickets or support staff" ON public.support_tickets FOR SELECT TO authenticated
  USING (
    org_id = public.current_org_id()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'support_agent')
    OR public.has_role(auth.uid(), 'support_lead')
    OR public.has_role(auth.uid(), 'engineer_on_call')
  );
-- No direct INSERT/UPDATE grants — every write goes through the RPCs below.

CREATE TABLE public.support_ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets ON DELETE CASCADE,
  author_id uuid NOT NULL DEFAULT auth.uid(),
  body text NOT NULL,
  -- 'internal' notes are PERMANENTLY separated from 'customer' replies at the RLS level below —
  -- there is no admin action anywhere in this schema that reclassifies a row from one to the other.
  visibility text NOT NULL DEFAULT 'customer' CHECK (visibility IN ('customer', 'internal')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.support_ticket_messages TO authenticated;
GRANT ALL ON public.support_ticket_messages TO service_role;
ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customer sees only customer-visible messages on own org tickets"
  ON public.support_ticket_messages FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'support_agent')
    OR public.has_role(auth.uid(), 'support_lead')
    OR public.has_role(auth.uid(), 'engineer_on_call')
    OR (
      visibility = 'customer'
      AND EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.org_id = public.current_org_id())
    )
  );

CREATE TABLE public.support_ticket_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets ON DELETE CASCADE,
  actor_id uuid NOT NULL DEFAULT auth.uid(),
  event_type text NOT NULL,
  previous_status public.support_ticket_status,
  new_status public.support_ticket_status,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.support_ticket_events TO authenticated;
GRANT ALL ON public.support_ticket_events TO service_role;
ALTER TABLE public.support_ticket_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "events visible to own org or support staff" ON public.support_ticket_events FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'support_agent')
    OR public.has_role(auth.uid(), 'support_lead')
    OR public.has_role(auth.uid(), 'engineer_on_call')
    OR EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.org_id = public.current_org_id())
  );

-- SMS/WhatsApp Notification Readiness shell (section 13): every event that WOULD have used an
-- unconfigured channel is logged here instead of silently dropped or blocking anything.
CREATE TABLE public.notification_skip_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL CHECK (channel IN ('sms', 'whatsapp')),
  event_type text NOT NULL,
  related_ticket_id uuid REFERENCES public.support_tickets ON DELETE SET NULL,
  reason text NOT NULL DEFAULT 'provider_not_configured',
  fallback_channel text NOT NULL DEFAULT 'in_app_and_email',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.notification_skip_events TO authenticated;
GRANT ALL ON public.notification_skip_events TO service_role;
ALTER TABLE public.notification_skip_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin and support staff read skip events" ON public.notification_skip_events FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'support_agent')
    OR public.has_role(auth.uid(), 'support_lead')
  );

CREATE OR REPLACE FUNCTION public.support_create_ticket(
  p_subject text,
  p_description text,
  p_priority public.support_ticket_priority DEFAULT 'medium'
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
  v_org uuid;
  v_sla interval;
BEGIN
  v_org := public.current_org_id();
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'You must belong to an organisation to submit a ticket';
  END IF;
  IF p_subject IS NULL OR length(trim(p_subject)) = 0 THEN
    RAISE EXCEPTION 'A subject is required';
  END IF;
  IF p_description IS NULL OR length(trim(p_description)) = 0 THEN
    RAISE EXCEPTION 'A description is required';
  END IF;

  v_sla := CASE p_priority
    WHEN 'urgent' THEN interval '4 hours'
    WHEN 'high' THEN interval '24 hours'
    WHEN 'medium' THEN interval '72 hours'
    ELSE interval '120 hours'
  END;

  INSERT INTO public.support_tickets (org_id, requester_id, subject, priority, sla_due_at)
  VALUES (v_org, auth.uid(), p_subject, p_priority, now() + v_sla)
  RETURNING id INTO v_id;

  INSERT INTO public.support_ticket_messages (ticket_id, author_id, body, visibility)
  VALUES (v_id, auth.uid(), p_description, 'customer');

  INSERT INTO public.support_ticket_events (ticket_id, actor_id, event_type, new_status)
  VALUES (v_id, auth.uid(), 'ticket_created', 'open');

  -- Readiness shell: this event WOULD notify support staff by SMS/WhatsApp of a new urgent ticket
  -- once those channels are approved; for now it always falls back and the skip is audited.
  IF p_priority = 'urgent' THEN
    INSERT INTO public.notification_skip_events (channel, event_type, related_ticket_id)
    VALUES ('sms', 'notification_skipped_provider_not_configured', v_id);
  END IF;

  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.support_create_ticket(text, text, public.support_ticket_priority) TO authenticated;

-- Customer reply: always customer-visible, never internal, regardless of who calls it (enforced
-- by hardcoding visibility here rather than trusting a client-supplied value).
CREATE OR REPLACE FUNCTION public.support_customer_reply(p_ticket_id uuid, p_body text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org uuid;
BEGIN
  SELECT org_id INTO v_org FROM public.support_tickets WHERE id = p_ticket_id;
  IF v_org IS NULL OR v_org <> public.current_org_id() THEN
    RAISE EXCEPTION 'Ticket not found';
  END IF;
  IF p_body IS NULL OR length(trim(p_body)) = 0 THEN
    RAISE EXCEPTION 'A message body is required';
  END IF;
  INSERT INTO public.support_ticket_messages (ticket_id, author_id, body, visibility)
  VALUES (p_ticket_id, auth.uid(), p_body, 'customer');
  UPDATE public.support_tickets
  SET status = CASE WHEN status = 'waiting_on_customer' THEN 'in_progress'::public.support_ticket_status ELSE status END,
      updated_at = now()
  WHERE id = p_ticket_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.support_customer_reply(uuid, text) TO authenticated;

-- Agent reply: staff-only, explicit visibility choice (customer-facing reply vs. internal note),
-- so the permanent separation is a deliberate choice at write time, not something inferred later.
CREATE OR REPLACE FUNCTION public.support_agent_reply(
  p_ticket_id uuid,
  p_body text,
  p_visibility text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'support_agent')
    OR public.has_role(auth.uid(), 'support_lead')
    OR public.has_role(auth.uid(), 'engineer_on_call')
  ) THEN
    RAISE EXCEPTION 'Not authorised to reply as support staff';
  END IF;
  IF p_visibility NOT IN ('customer', 'internal') THEN
    RAISE EXCEPTION 'Visibility must be customer or internal';
  END IF;
  IF p_body IS NULL OR length(trim(p_body)) = 0 THEN
    RAISE EXCEPTION 'A message body is required';
  END IF;
  INSERT INTO public.support_ticket_messages (ticket_id, author_id, body, visibility)
  VALUES (p_ticket_id, auth.uid(), p_body, p_visibility);
  UPDATE public.support_tickets
  SET status = CASE WHEN status = 'open' THEN 'in_progress'::public.support_ticket_status ELSE status END,
      updated_at = now()
  WHERE id = p_ticket_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.support_agent_reply(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.support_assign(p_ticket_id uuid, p_agent_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'support_lead')
  ) THEN
    RAISE EXCEPTION 'Not authorised to assign tickets';
  END IF;
  UPDATE public.support_tickets
  SET assigned_agent_id = p_agent_id,
      status = CASE WHEN status = 'open' THEN 'in_progress'::public.support_ticket_status ELSE status END,
      updated_at = now()
  WHERE id = p_ticket_id;
  INSERT INTO public.support_ticket_events (ticket_id, actor_id, event_type, note)
  VALUES (p_ticket_id, auth.uid(), 'assignment_change', 'assigned to ' || p_agent_id::text);
END;
$$;
GRANT EXECUTE ON FUNCTION public.support_assign(uuid, uuid) TO authenticated;

-- Escalation: hands the ticket to engineer_on_call and moves status to 'escalated'. This is the
-- technical-escalation path the acceptance gate requires; release linkage is the plain
-- `related_release` text field (real GitHub integration deferred).
CREATE OR REPLACE FUNCTION public.support_escalate(
  p_ticket_id uuid,
  p_reason text,
  p_related_release text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_prev public.support_ticket_status;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'support_agent')
    OR public.has_role(auth.uid(), 'support_lead')
  ) THEN
    RAISE EXCEPTION 'Not authorised to escalate tickets';
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'An escalation reason is required';
  END IF;
  SELECT status INTO v_prev FROM public.support_tickets WHERE id = p_ticket_id;
  UPDATE public.support_tickets
  SET status = 'escalated',
      related_release = COALESCE(p_related_release, related_release),
      updated_at = now()
  WHERE id = p_ticket_id;
  INSERT INTO public.support_ticket_events (ticket_id, actor_id, event_type, previous_status, new_status, note)
  VALUES (p_ticket_id, auth.uid(), 'escalated', v_prev, 'escalated', p_reason);
  -- Readiness shell: escalation would page engineer_on_call by SMS/WhatsApp once approved.
  INSERT INTO public.notification_skip_events (channel, event_type, related_ticket_id)
  VALUES ('whatsapp', 'notification_skipped_provider_not_configured', p_ticket_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.support_escalate(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.support_set_status(p_ticket_id uuid, p_status public.support_ticket_status)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_prev public.support_ticket_status;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'support_agent')
    OR public.has_role(auth.uid(), 'support_lead')
    OR public.has_role(auth.uid(), 'engineer_on_call')
  ) THEN
    RAISE EXCEPTION 'Not authorised to update ticket status';
  END IF;
  SELECT status INTO v_prev FROM public.support_tickets WHERE id = p_ticket_id;
  UPDATE public.support_tickets
  SET status = p_status,
      resolved_at = CASE WHEN p_status = 'resolved' THEN now() ELSE resolved_at END,
      closed_at = CASE WHEN p_status = 'closed' THEN now() ELSE closed_at END,
      updated_at = now()
  WHERE id = p_ticket_id;
  INSERT INTO public.support_ticket_events (ticket_id, actor_id, event_type, previous_status, new_status)
  VALUES (p_ticket_id, auth.uid(), 'status_change', v_prev, p_status);
END;
$$;
GRANT EXECUTE ON FUNCTION public.support_set_status(uuid, public.support_ticket_status) TO authenticated;

CREATE TRIGGER touch_support_tickets BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed the SMS/WhatsApp readiness display state used by the admin UI (reuses the existing
-- admin_settings mechanism rather than inventing a second settings table).
INSERT INTO public.admin_settings (key, value) VALUES
  ('sms_channel', '{"status": "not_configured"}'::jsonb),
  ('whatsapp_channel', '{"status": "not_configured"}'::jsonb)
ON CONFLICT (key) DO NOTHING;
