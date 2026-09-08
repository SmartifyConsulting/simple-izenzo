-- Funder Workspace (rebuild requirements section 9). Per the spec this is "the single most
-- access-control-critical module in the whole platform" — enforced here at the data layer (RLS),
-- not just by hiding nav links, so a direct API call or altered param from a funder session
-- cannot leak another funder's data or unreleased counterparty information.
--
-- Core rule: counterparty information is completely hidden from a funder until an Izenzo admin
-- makes an explicit, field-scoped release naming exactly which fields/summary/documents are
-- exposed. Funders can only ever read what a release names, for their own funder org, while the
-- release is neither revoked nor expired.
--
-- Explicitly OUT OF SCOPE for this first slice (documented, not silently dropped):
--   - Document release/download: this migration models `released_document_ids` as a reference
--     list, but does not build the real Storage + signed-URL pipeline yet — that is the same
--     "evidence pack" pipeline deferred from Phase 4, and is a dedicated follow-up.
--   - A denied-access audit log table (section 9 requires denied attempts to be logged). RLS
--     already makes leakage impossible; a queryable denial log is a follow-up once the real access
--     pattern (edge function vs. direct client calls) is decided, so it isn't invented here.
--   - MFA enforcement for funder_admin (referenced in section 10/19 as a platform-wide gap, not
--     specific to this module) — tracked separately, not part of this migration.

CREATE TABLE public.funder_orgs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.funder_orgs TO authenticated;
GRANT ALL ON public.funder_orgs TO service_role;
ALTER TABLE public.funder_orgs ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.funder_org_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funder_org_id uuid NOT NULL REFERENCES public.funder_orgs ON DELETE CASCADE,
  user_id uuid NOT NULL,
  funder_role text NOT NULL DEFAULT 'funder_user' CHECK (funder_role IN ('funder_admin', 'funder_user')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (funder_org_id, user_id)
);
GRANT SELECT ON public.funder_org_members TO authenticated;
GRANT ALL ON public.funder_org_members TO service_role;
ALTER TABLE public.funder_org_members ENABLE ROW LEVEL SECURITY;

-- A funder user only ever administers their OWN funder org's membership list, never any other's,
-- and never gains Izenzo platform-admin/governance/billing rights by being a funder_admin.
CREATE POLICY "own funder org membership only" ON public.funder_org_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "funder orgs visible to own members and admin" ON public.funder_orgs FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.funder_org_members m WHERE m.funder_org_id = id AND m.user_id = auth.uid())
  );

CREATE OR REPLACE FUNCTION public.current_funder_org_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT funder_org_id FROM public.funder_org_members WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE TYPE public.release_permission AS ENUM ('view', 'view_and_download');

CREATE TABLE public.funder_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funder_org_id uuid NOT NULL REFERENCES public.funder_orgs ON DELETE CASCADE,
  transaction_id uuid REFERENCES public.transactions ON DELETE SET NULL,
  counterparty_id uuid NOT NULL REFERENCES public.counterparties ON DELETE CASCADE,
  -- Field-scoped release: exact identity fields exposed, e.g. {"legal_name":true,"registration_number":true}.
  -- Never a blanket "release everything" flag — the admin RPC below requires an explicit non-empty list.
  released_fields jsonb NOT NULL,
  -- Approved summary only: verification_status, risk_band, screening_status, check_date, freshness,
  -- outstanding_requirements. Never raw provider data, full screening hits, or analyst notes.
  compliance_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  released_document_ids uuid[] NOT NULL DEFAULT '{}',
  pack_version text NOT NULL DEFAULT 'v1',
  permissions public.release_permission NOT NULL DEFAULT 'view',
  consent_basis text NOT NULL,
  reason text NOT NULL,
  expiry timestamptz NOT NULL,
  released_by uuid NOT NULL DEFAULT auth.uid(),
  revoked_at timestamptz,
  revoked_by uuid,
  revoke_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.funder_releases TO authenticated;
GRANT ALL ON public.funder_releases TO service_role;
ALTER TABLE public.funder_releases ENABLE ROW LEVEL SECURITY;

-- The hard boundary: a funder can only ever see releases scoped to their OWN funder org, and only
-- while not revoked and not expired. An admin sees everything (for audit/management).
CREATE POLICY "funder sees only own org active releases, admin sees all"
  ON public.funder_releases FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (
      funder_org_id = public.current_funder_org_id()
      AND revoked_at IS NULL
      AND expiry > now()
    )
  );
-- No direct INSERT/UPDATE grants — creation and revocation both go through admin-only RPCs.

CREATE TABLE public.funder_release_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id uuid NOT NULL REFERENCES public.funder_releases ON DELETE CASCADE,
  actor_id uuid NOT NULL DEFAULT auth.uid(),
  event_type text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.funder_release_events TO authenticated;
GRANT ALL ON public.funder_release_events TO service_role;
ALTER TABLE public.funder_release_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "events visible to the release's own funder org and admin"
  ON public.funder_release_events FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.funder_releases r
      WHERE r.id = release_id AND r.funder_org_id = public.current_funder_org_id()
    )
  );

CREATE TYPE public.funder_decision_type AS ENUM ('recommend_fund', 'decline', 'request_more_info');

CREATE TABLE public.funder_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id uuid NOT NULL REFERENCES public.funder_releases ON DELETE CASCADE,
  decision public.funder_decision_type NOT NULL,
  note text,
  decided_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.funder_decisions TO authenticated;
GRANT ALL ON public.funder_decisions TO service_role;
ALTER TABLE public.funder_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "decisions visible to the release's own funder org and admin"
  ON public.funder_decisions FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.funder_releases r
      WHERE r.id = release_id AND r.funder_org_id = public.current_funder_org_id()
    )
  );

-- Admin: create a field-scoped release. Requires a non-empty field list and a consent basis —
-- there is no "release everything" shortcut available even to admins via this RPC.
CREATE OR REPLACE FUNCTION public.admin_funder_create_release(
  p_funder_org_id uuid,
  p_counterparty_id uuid,
  p_released_fields jsonb,
  p_consent_basis text,
  p_reason text,
  p_expiry timestamptz,
  p_transaction_id uuid DEFAULT NULL,
  p_compliance_summary jsonb DEFAULT '{}'::jsonb,
  p_permissions public.release_permission DEFAULT 'view'
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorised to release counterparty information to a funder';
  END IF;
  IF p_released_fields IS NULL OR p_released_fields = '{}'::jsonb THEN
    RAISE EXCEPTION 'At least one field must be explicitly named in a release';
  END IF;
  IF p_consent_basis IS NULL OR length(trim(p_consent_basis)) = 0 THEN
    RAISE EXCEPTION 'A consent basis is required';
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'A reason is required';
  END IF;
  IF p_expiry <= now() THEN
    RAISE EXCEPTION 'Expiry must be in the future';
  END IF;

  INSERT INTO public.funder_releases (
    funder_org_id, transaction_id, counterparty_id, released_fields, compliance_summary,
    pack_version, permissions, consent_basis, reason, expiry, released_by
  )
  VALUES (
    p_funder_org_id, p_transaction_id, p_counterparty_id, p_released_fields, p_compliance_summary,
    'v1', p_permissions, p_consent_basis, p_reason, p_expiry, auth.uid()
  )
  RETURNING id INTO v_id;

  INSERT INTO public.funder_release_events (release_id, actor_id, event_type)
  VALUES (v_id, auth.uid(), 'created');

  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_funder_create_release(
  uuid, uuid, jsonb, text, text, timestamptz, uuid, jsonb, public.release_permission
) TO authenticated;

-- Admin: revoke. Immediately kills visibility (RLS checks revoked_at IS NULL) without deleting
-- the historical audit record.
CREATE OR REPLACE FUNCTION public.admin_funder_revoke_release(p_id uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorised to revoke a funder release';
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'A revocation reason is required';
  END IF;
  UPDATE public.funder_releases
  SET revoked_at = now(), revoked_by = auth.uid(), revoke_reason = p_reason
  WHERE id = p_id AND revoked_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Release not found or already revoked';
  END IF;
  INSERT INTO public.funder_release_events (release_id, actor_id, event_type, note)
  VALUES (p_id, auth.uid(), 'revoked', p_reason);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_funder_revoke_release(uuid, text) TO authenticated;

-- Funder: record that they viewed a release. Re-checks the same active/own-org condition the RLS
-- policy enforces, so a revoked or expired release cannot be "viewed" even via direct RPC call.
CREATE OR REPLACE FUNCTION public.funder_record_view(p_release_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org uuid;
BEGIN
  SELECT funder_org_id INTO v_org FROM public.funder_releases
  WHERE id = p_release_id AND revoked_at IS NULL AND expiry > now();
  IF v_org IS NULL OR v_org <> public.current_funder_org_id() THEN
    RAISE EXCEPTION 'Release not available to view';
  END IF;
  INSERT INTO public.funder_release_events (release_id, actor_id, event_type)
  VALUES (p_release_id, auth.uid(), 'viewed');
END;
$$;
GRANT EXECUTE ON FUNCTION public.funder_record_view(uuid) TO authenticated;

-- Funder: record a decision (respond / recommend / decline / request more info). Requires
-- view_and_download-or-view permission (any active release allows a decision — download itself is
-- gated separately once the real document pipeline exists).
CREATE OR REPLACE FUNCTION public.funder_record_decision(
  p_release_id uuid,
  p_decision public.funder_decision_type,
  p_note text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org uuid;
BEGIN
  SELECT funder_org_id INTO v_org FROM public.funder_releases
  WHERE id = p_release_id AND revoked_at IS NULL AND expiry > now();
  IF v_org IS NULL OR v_org <> public.current_funder_org_id() THEN
    RAISE EXCEPTION 'Release not available';
  END IF;
  INSERT INTO public.funder_decisions (release_id, decision, note, decided_by)
  VALUES (p_release_id, p_decision, p_note, auth.uid());
  INSERT INTO public.funder_release_events (release_id, actor_id, event_type, note)
  VALUES (p_release_id, auth.uid(), 'decision_recorded', p_decision::text);
END;
$$;
GRANT EXECUTE ON FUNCTION public.funder_record_decision(uuid, public.funder_decision_type, text) TO authenticated;

-- Admin: manage funder org + membership (minimal, so this module is testable end to end).
CREATE OR REPLACE FUNCTION public.admin_funder_create_org(p_name text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorised to create a funder org';
  END IF;
  INSERT INTO public.funder_orgs (name) VALUES (p_name) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_funder_create_org(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_funder_add_member(
  p_funder_org_id uuid,
  p_user_id uuid,
  p_funder_role text DEFAULT 'funder_user'
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorised to add a funder org member';
  END IF;
  INSERT INTO public.funder_org_members (funder_org_id, user_id, funder_role)
  VALUES (p_funder_org_id, p_user_id, p_funder_role)
  ON CONFLICT (funder_org_id, user_id) DO UPDATE SET funder_role = EXCLUDED.funder_role;
  -- Grant the 'funder' app_role too, so the client-side route guard can identify them; the real
  -- boundary enforcement is the RLS policies above, this role is only for UI gating/nav.
  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_user_id, 'funder')
  ON CONFLICT DO NOTHING;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_funder_add_member(uuid, uuid, text) TO authenticated;
