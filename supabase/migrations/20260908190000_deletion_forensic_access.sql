-- Deletion / Forensic Events Access (rebuild requirements section 6). Deletion forensic records
-- (what was deleted, why, by whom, whether a legal hold applied, whether the deletion completed
-- correctly) are immutable, read-only evidence — no one may edit or delete them, ever. Access is a
-- "mixed model": standing access limited to designated platform auditors; every other auditor gets
-- purpose-bound, scoped, time-limited access, with approval/use/export/expiry/revocation all logged.
--
-- Explicitly OUT OF SCOPE for this pass (documented, not silently dropped):
--   - No hard-delete pipeline in this app currently produces these records automatically (nothing
--     performs a real destructive delete today — everything built this session is soft-state,
--     e.g. revoke/close/archive). log_deletion_forensic_event is provided as the hook point for
--     whenever a real deletion feature is built, and a manual admin-recorded path covers the DSAR-
--     driven case (see section 10) in the meantime.
--   - Automatic access-removal on duty change/departure (the "removed immediately" requirement) —
--     there's no HR/identity-lifecycle event source in this app to trigger it from; admins must
--     revoke manually today.

CREATE TABLE public.deletion_forensic_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  deleted_by uuid,
  reason text NOT NULL,
  legal_hold_applied boolean NOT NULL DEFAULT false,
  legal_hold_reference text,
  deletion_method text NOT NULL DEFAULT 'soft_delete',
  completed_correctly boolean NOT NULL DEFAULT true,
  failure_detail text,
  -- Fields excluded from the record for a justified legal/privacy reason (named, never silent).
  redacted_fields text[] NOT NULL DEFAULT '{}',
  redaction_justification text,
  recorded_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.deletion_forensic_records TO authenticated;
GRANT ALL ON public.deletion_forensic_records TO service_role;
ALTER TABLE public.deletion_forensic_records ENABLE ROW LEVEL SECURITY;
-- SELECT policy for this table is created further down, after auditor_access_grants exists (it
-- references that table) — no UPDATE/DELETE policy exists anywhere in this migration, by design:
-- immutable means immutable even to admins. The only way a record's story changes is a new,
-- separately linked finding.

-- Corrections/findings about a record go in a SEPARATE linked workflow — the original row above is
-- never touched by this table.
CREATE TABLE public.deletion_forensic_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id uuid NOT NULL REFERENCES public.deletion_forensic_records ON DELETE CASCADE,
  finding text NOT NULL,
  raised_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.deletion_forensic_findings TO authenticated;
GRANT ALL ON public.deletion_forensic_findings TO service_role;
ALTER TABLE public.deletion_forensic_findings ENABLE ROW LEVEL SECURITY;
-- SELECT policy for this table is also created further down, for the same reason.

-- Mixed access model. is_standing = true means a designated platform auditor (expires_at ignored);
-- false means purpose-bound and MUST have an expiry.
CREATE TABLE public.auditor_access_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auditor_id uuid NOT NULL,
  granted_by uuid NOT NULL DEFAULT auth.uid(),
  purpose text NOT NULL,
  is_standing boolean NOT NULL DEFAULT false,
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid,
  revoke_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT purpose_bound_grants_need_expiry CHECK (is_standing OR expires_at IS NOT NULL)
);
GRANT SELECT ON public.auditor_access_grants TO authenticated;
GRANT ALL ON public.auditor_access_grants TO service_role;
ALTER TABLE public.auditor_access_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin sees all grants, auditor sees own" ON public.auditor_access_grants FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR auditor_id = auth.uid());

CREATE TABLE public.auditor_access_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id uuid NOT NULL REFERENCES public.auditor_access_grants ON DELETE CASCADE,
  actor_id uuid NOT NULL DEFAULT auth.uid(),
  event_type text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.auditor_access_events TO authenticated;
GRANT ALL ON public.auditor_access_events TO service_role;
ALTER TABLE public.auditor_access_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin sees all access events, auditor sees own" ON public.auditor_access_events FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.auditor_access_grants g WHERE g.id = grant_id AND g.auditor_id = auth.uid())
  );

-- Deferred from above: these two reference auditor_access_grants, which now exists.
CREATE POLICY "admin and granted auditors read forensic records"
  ON public.deletion_forensic_records FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.auditor_access_grants g
      WHERE g.auditor_id = auth.uid()
        AND g.revoked_at IS NULL
        AND (g.expires_at IS NULL OR g.expires_at > now())
    )
  );

CREATE POLICY "admin and granted auditors read findings" ON public.deletion_forensic_findings FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.auditor_access_grants g
      WHERE g.auditor_id = auth.uid() AND g.revoked_at IS NULL AND (g.expires_at IS NULL OR g.expires_at > now())
    )
  );

CREATE OR REPLACE FUNCTION public.admin_grant_auditor_access(
  p_auditor_id uuid,
  p_purpose text,
  p_is_standing boolean DEFAULT false,
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorised to grant auditor access';
  END IF;
  IF p_purpose IS NULL OR length(trim(p_purpose)) = 0 THEN
    RAISE EXCEPTION 'A purpose is required for every access grant';
  END IF;
  IF NOT p_is_standing AND p_expires_at IS NULL THEN
    RAISE EXCEPTION 'Purpose-bound access must have an expiry';
  END IF;

  INSERT INTO public.auditor_access_grants (auditor_id, granted_by, purpose, is_standing, expires_at)
  VALUES (p_auditor_id, auth.uid(), p_purpose, p_is_standing, p_expires_at)
  RETURNING id INTO v_id;

  INSERT INTO public.auditor_access_events (grant_id, actor_id, event_type, note)
  VALUES (v_id, auth.uid(), 'granted', p_purpose);

  -- Give the user the 'auditor' role too, so client-side UI can identify them; the actual read
  -- boundary is the grant-based RLS above, this role is only for nav/UI gating.
  INSERT INTO public.user_roles (user_id, role) VALUES (p_auditor_id, 'auditor') ON CONFLICT DO NOTHING;

  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_grant_auditor_access(uuid, text, boolean, timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_revoke_auditor_access(p_grant_id uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorised to revoke auditor access';
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'A revocation reason is required';
  END IF;
  UPDATE public.auditor_access_grants
  SET revoked_at = now(), revoked_by = auth.uid(), revoke_reason = p_reason
  WHERE id = p_grant_id AND revoked_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Grant not found or already revoked';
  END IF;
  INSERT INTO public.auditor_access_events (grant_id, actor_id, event_type, note)
  VALUES (p_grant_id, auth.uid(), 'revoked', p_reason);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_revoke_auditor_access(uuid, text) TO authenticated;

-- Called by the auditor's client right before rendering forensic records, and again on export, so
-- "use" and "export" are both logged per the spec, distinctly from "granted"/"revoked"/"expired".
CREATE OR REPLACE FUNCTION public.log_auditor_access_use(p_grant_id uuid, p_event_type text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ok boolean;
BEGIN
  IF p_event_type NOT IN ('viewed', 'exported') THEN
    RAISE EXCEPTION 'event_type must be viewed or exported';
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.auditor_access_grants
    WHERE id = p_grant_id AND auditor_id = auth.uid() AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > now())
  ) INTO v_ok;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'No active access grant';
  END IF;
  INSERT INTO public.auditor_access_events (grant_id, actor_id, event_type)
  VALUES (p_grant_id, auth.uid(), p_event_type);
END;
$$;
GRANT EXECUTE ON FUNCTION public.log_auditor_access_use(uuid, text) TO authenticated;

-- Manual admin path for recording a deletion forensic event (e.g. a DSAR-driven deletion) while
-- this app has no automated hard-delete pipeline of its own to hook into yet.
CREATE OR REPLACE FUNCTION public.admin_log_deletion_forensic_event(
  p_entity_type text,
  p_entity_id text,
  p_reason text,
  p_legal_hold_applied boolean DEFAULT false,
  p_legal_hold_reference text DEFAULT NULL,
  p_deletion_method text DEFAULT 'soft_delete',
  p_completed_correctly boolean DEFAULT true,
  p_failure_detail text DEFAULT NULL,
  p_redacted_fields text[] DEFAULT '{}',
  p_redaction_justification text DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorised to record a deletion forensic event';
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'A reason is required';
  END IF;
  INSERT INTO public.deletion_forensic_records (
    entity_type, entity_id, deleted_by, reason, legal_hold_applied, legal_hold_reference,
    deletion_method, completed_correctly, failure_detail, redacted_fields, redaction_justification, recorded_by
  )
  VALUES (
    p_entity_type, p_entity_id, auth.uid(), p_reason, p_legal_hold_applied, p_legal_hold_reference,
    p_deletion_method, p_completed_correctly, p_failure_detail, p_redacted_fields, p_redaction_justification, auth.uid()
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_log_deletion_forensic_event(
  text, text, text, boolean, text, text, boolean, text, text[], text
) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_add_forensic_finding(p_record_id uuid, p_finding text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorised to add a forensic finding';
  END IF;
  IF p_finding IS NULL OR length(trim(p_finding)) = 0 THEN
    RAISE EXCEPTION 'A finding is required';
  END IF;
  INSERT INTO public.deletion_forensic_findings (record_id, finding, raised_by)
  VALUES (p_record_id, p_finding, auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_add_forensic_finding(uuid, text) TO authenticated;
