-- Real Evidence Pack pipeline (rebuild requirements section 8 Evidence Governance + the funder
-- workspace "download a sealed evidence pack" flagship action deferred from Phase 5, plus the
-- compliance case PDF export deferred from Phase 4). The known gap in the real platform is that
-- this action recorded intent and returned a UUID with no actual PDF — this migration is the data
-- layer for the real thing: an actual generated PDF, stored privately, hash-recorded, downloaded
-- only via a short-lived signed URL, and formally revocable (never edited) per Evidence Governance
-- decision 5.
--
-- The PDF itself is generated server-side by a TanStack Start server function (not this migration)
-- using pdf-lib, then uploaded here. This migration provides: the storage bucket + RLS, the
-- evidence_packs record (hash, version, issuer, revocation trail), and the RPCs that gate
-- issuance/revocation/download-logging to the right roles.
--
-- Explicitly OUT OF SCOPE for this pass (documented, not silently dropped):
--   - Document release/download for arbitrary uploaded case documents (this is the SEALED SUMMARY
--     pack only — case facts + decision + audit trail, or release facts + compliance summary —
--     never raw uploaded evidence files, which is a separate, larger document-management build).
--   - Automatic re-notification of "known recipients" on revocation (Evidence Governance decision 5
--     requires this eventually; there is no notification-delivery pipeline yet in this app to hook
--     it into, so revocation here records the fact and reason but does not send anything).

CREATE TYPE public.evidence_pack_source AS ENUM ('compliance_case', 'funder_release');

CREATE TABLE public.evidence_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type public.evidence_pack_source NOT NULL,
  compliance_case_id uuid REFERENCES public.compliance_cases ON DELETE CASCADE,
  funder_release_id uuid REFERENCES public.funder_releases ON DELETE CASCADE,
  pack_version text NOT NULL DEFAULT 'v1',
  storage_path text NOT NULL,
  sha256_hash text NOT NULL,
  issued_by uuid NOT NULL DEFAULT auth.uid(),
  issued_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_by uuid,
  revoke_reason text,
  -- Set on the OLD pack once a replacement is issued after a revocation, cross-referencing forward.
  superseded_by_pack_id uuid REFERENCES public.evidence_packs ON DELETE SET NULL,
  CONSTRAINT evidence_pack_exactly_one_source CHECK (
    (compliance_case_id IS NOT NULL AND funder_release_id IS NULL)
    OR (compliance_case_id IS NULL AND funder_release_id IS NOT NULL)
  )
);
GRANT SELECT ON public.evidence_packs TO authenticated;
GRANT ALL ON public.evidence_packs TO service_role;
ALTER TABLE public.evidence_packs ENABLE ROW LEVEL SECURITY;

-- Compliance-case packs: admin-only (internal artifact). Funder-release packs: admin, or a member
-- of the release's own funder org while the release itself is neither revoked nor expired — same
-- guard as funder_releases' own SELECT policy, so a revoked release's pack becomes unreachable
-- through this table too even though the pack record and storage object are preserved.
CREATE POLICY "admin sees all packs, funder sees own org's release packs"
  ON public.evidence_packs FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (
      funder_release_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.funder_releases r
        WHERE r.id = funder_release_id
          AND r.funder_org_id = public.current_funder_org_id()
          AND r.revoked_at IS NULL
          AND r.expiry > now()
          AND r.permissions = 'view_and_download'
      )
    )
  );
-- No direct INSERT/UPDATE grants — issuance and revocation go through the RPCs below, and the
-- actual file upload happens via the server function using these same RLS-respecting checks.

INSERT INTO storage.buckets (id, name, public)
VALUES ('evidence-packs', 'evidence-packs', false)
ON CONFLICT (id) DO NOTHING;

-- Admins can write/read anything under compliance/ or funder/.
CREATE POLICY "admin manage evidence pack files" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'evidence-packs' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'evidence-packs' AND public.has_role(auth.uid(), 'admin'));

-- A funder can download (SELECT) an object at funder/<funder_org_id>/... only if there's a
-- non-revoked evidence_packs row pointing at it whose release is their own org's, active, and
-- download-permitted. This mirrors the table-level RLS above at the storage layer, so a signed
-- URL request against a revoked pack's object is rejected even if the URL itself was cached.
CREATE POLICY "funder downloads own org's active release pack files" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'evidence-packs'
    AND (storage.foldername(name))[1] = 'funder'
    AND EXISTS (
      SELECT 1 FROM public.evidence_packs p
      JOIN public.funder_releases r ON r.id = p.funder_release_id
      WHERE p.storage_path = name
        AND p.revoked_at IS NULL
        AND r.funder_org_id = public.current_funder_org_id()
        AND r.revoked_at IS NULL
        AND r.expiry > now()
        AND r.permissions = 'view_and_download'
    )
  );

CREATE TABLE public.evidence_pack_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id uuid NOT NULL REFERENCES public.evidence_packs ON DELETE CASCADE,
  actor_id uuid NOT NULL DEFAULT auth.uid(),
  event_type text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.evidence_pack_events TO authenticated;
GRANT ALL ON public.evidence_pack_events TO service_role;
ALTER TABLE public.evidence_pack_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "events visible same as the pack" ON public.evidence_pack_events FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.evidence_packs p
      JOIN public.funder_releases r ON r.id = p.funder_release_id
      WHERE p.id = pack_id AND r.funder_org_id = public.current_funder_org_id()
    )
  );

-- Records a completed pack (the server function uploads the file first, computes the hash, then
-- calls this to create the audit-controlled record). Admin-only, and requires the case to be
-- closed / the release to still be active, so a pack can't be issued for an unresolved case or an
-- already-revoked release.
CREATE OR REPLACE FUNCTION public.admin_issue_evidence_pack(
  p_source_type public.evidence_pack_source,
  p_storage_path text,
  p_sha256_hash text,
  p_compliance_case_id uuid DEFAULT NULL,
  p_funder_release_id uuid DEFAULT NULL,
  p_pack_version text DEFAULT 'v1',
  p_supersedes_pack_id uuid DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
  v_case_status public.compliance_case_status;
  v_release_revoked timestamptz;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorised to issue an evidence pack';
  END IF;

  IF p_source_type = 'compliance_case' THEN
    IF p_compliance_case_id IS NULL THEN
      RAISE EXCEPTION 'compliance_case_id is required for a compliance_case pack';
    END IF;
    SELECT status INTO v_case_status FROM public.compliance_cases WHERE id = p_compliance_case_id;
    IF v_case_status NOT IN ('closed_approved', 'closed_rejected', 'closed_no_action') THEN
      RAISE EXCEPTION 'A pack can only be issued for a closed case';
    END IF;
  ELSIF p_source_type = 'funder_release' THEN
    IF p_funder_release_id IS NULL THEN
      RAISE EXCEPTION 'funder_release_id is required for a funder_release pack';
    END IF;
    SELECT revoked_at INTO v_release_revoked FROM public.funder_releases WHERE id = p_funder_release_id;
    IF v_release_revoked IS NOT NULL THEN
      RAISE EXCEPTION 'Cannot issue a pack for a revoked release';
    END IF;
  END IF;

  INSERT INTO public.evidence_packs (
    source_type, compliance_case_id, funder_release_id, pack_version, storage_path, sha256_hash, issued_by
  )
  VALUES (
    p_source_type, p_compliance_case_id, p_funder_release_id, p_pack_version, p_storage_path, p_sha256_hash, auth.uid()
  )
  RETURNING id INTO v_id;

  INSERT INTO public.evidence_pack_events (pack_id, actor_id, event_type)
  VALUES (v_id, auth.uid(), 'issued');

  IF p_supersedes_pack_id IS NOT NULL THEN
    UPDATE public.evidence_packs SET superseded_by_pack_id = v_id WHERE id = p_supersedes_pack_id;
    INSERT INTO public.evidence_pack_events (pack_id, actor_id, event_type, note)
    VALUES (p_supersedes_pack_id, auth.uid(), 'superseded', 'replaced by ' || v_id::text);
  END IF;

  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_issue_evidence_pack(
  public.evidence_pack_source, text, text, uuid, uuid, text, uuid
) TO authenticated;

-- Revoke: NEVER edits or deletes the original (per Evidence Governance decision 5) — marks it
-- revoked with reason/authority/timestamp, storage object and hash stay exactly as issued.
CREATE OR REPLACE FUNCTION public.admin_revoke_evidence_pack(p_id uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorised to revoke an evidence pack';
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'A revocation reason is required';
  END IF;
  UPDATE public.evidence_packs
  SET revoked_at = now(), revoked_by = auth.uid(), revoke_reason = p_reason
  WHERE id = p_id AND revoked_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pack not found or already revoked';
  END IF;
  INSERT INTO public.evidence_pack_events (pack_id, actor_id, event_type, note)
  VALUES (p_id, auth.uid(), 'revoked', p_reason);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_revoke_evidence_pack(uuid, text) TO authenticated;

-- Logs a download attempt/success. Called by the client right before requesting the signed URL;
-- re-checks the same conditions the storage RLS policy enforces so the audit log and actual access
-- can never disagree with each other.
CREATE OR REPLACE FUNCTION public.log_evidence_pack_download(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ok boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.evidence_packs p
    LEFT JOIN public.funder_releases r ON r.id = p.funder_release_id
    WHERE p.id = p_id
      AND p.revoked_at IS NULL
      AND (
        public.has_role(auth.uid(), 'admin')
        OR (
          r.id IS NOT NULL
          AND r.funder_org_id = public.current_funder_org_id()
          AND r.revoked_at IS NULL
          AND r.expiry > now()
          AND r.permissions = 'view_and_download'
        )
      )
  ) INTO v_ok;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'Pack not available to download';
  END IF;
  INSERT INTO public.evidence_pack_events (pack_id, actor_id, event_type)
  VALUES (p_id, auth.uid(), 'downloaded');
END;
$$;
GRANT EXECUTE ON FUNCTION public.log_evidence_pack_download(uuid) TO authenticated;
