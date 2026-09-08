-- Public API Commercialization (rebuild requirements sections 2, 3, 11 — Phase 6).
-- Data model + admin/client surfaces for a governed, read-only institutional signal API. The
-- actual HTTP gateway (separate sandbox/production behaviour, key auth, rate limiting, webhook
-- delivery) is a Supabase Edge Function (supabase/functions/api-gateway) that reads/writes these
-- tables using the service role — this migration is its data layer plus the admin/client UI.
--
-- Explicitly OUT OF SCOPE for this first slice (documented, not silently dropped):
--   - True separate base-URL domains (api-sandbox.trade.izenzo.co.za / api.trade.izenzo.co.za) —
--     that needs DNS/custom-domain configuration outside this session's reach. The Edge Function
--     instead reads the environment from the URL path (/sandbox/v1/... vs /production/v1/...) and
--     enforces that a key's own environment must match, which gives the same hard separation
--     guarantee the spec cares about even though the domain itself isn't split yet.
--   - IP allowlist enforcement (the column exists; the Edge Function does not yet check it).
--   - The full go-live checklist gate (signed terms, pricing, named contacts) — production key
--     creation here only enforces the two hard requirements the spec calls non-negotiable
--     (commercial_owner + compliance_owner recorded), not the whole checklist.
--   - Self-serve signup, OAuth/SSO, bulk export, evidence-pack download via API — all explicitly
--     deferred from V1 in the spec itself, not just this pass.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE public.api_key_environment AS ENUM ('sandbox', 'production');
CREATE TYPE public.api_key_status AS ENUM ('active', 'suspended', 'revoked');

CREATE TABLE public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  environment public.api_key_environment NOT NULL,
  org_id uuid NOT NULL REFERENCES public.organisations ON DELETE CASCADE,
  name text NOT NULL,
  key_prefix text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  scopes text[] NOT NULL DEFAULT ARRAY[
    'api:status_read', 'counterparty:lookup', 'counterparty:summary_read', 'usage:read'
  ],
  status public.api_key_status NOT NULL DEFAULT 'active',
  monthly_allowance integer NOT NULL DEFAULT 5000,
  ip_allowlist text[] NOT NULL DEFAULT '{}',
  commercial_owner text,
  compliance_owner text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  last_used_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid,
  revoke_reason text
);
GRANT SELECT ON public.api_keys TO authenticated;
GRANT ALL ON public.api_keys TO service_role;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- A client only ever sees their own org's keys (never the raw key value itself — key_hash is a
-- SHA-256 digest, and key_prefix is only the first 8 characters, shown once at creation like any
-- normal API key UX). Admins see all keys for management.
CREATE POLICY "own org keys or admin" ON public.api_keys FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() OR public.has_role(auth.uid(), 'admin'));
-- No direct INSERT/UPDATE grants — creation/suspension/revocation/rotation all go through the
-- admin-only RPCs below, per the spec's "only platform_admin" rule.

CREATE TABLE public.api_request_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  environment public.api_key_environment NOT NULL,
  api_key_id uuid REFERENCES public.api_keys ON DELETE SET NULL,
  org_id uuid,
  endpoint text NOT NULL,
  method text NOT NULL,
  request_id uuid NOT NULL,
  correlation_id uuid,
  response_status integer NOT NULL,
  error_code text,
  latency_ms integer NOT NULL,
  billable boolean NOT NULL DEFAULT false,
  token_cost numeric NOT NULL DEFAULT 0,
  source_ip text,
  user_agent text,
  scopes_evaluated text[] NOT NULL DEFAULT '{}',
  rate_limit_decision text NOT NULL DEFAULT 'allowed',
  request_payload_hash text,
  previous_log_hash text,
  log_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.api_request_logs TO authenticated;
GRANT ALL ON public.api_request_logs TO service_role;
ALTER TABLE public.api_request_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own org logs or admin" ON public.api_request_logs FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() OR public.has_role(auth.uid(), 'admin'));
-- No client INSERT grant at all — only the Edge Function (service role) writes logs, which is
-- what makes the hash chain and billing flag trustworthy.

CREATE INDEX api_request_logs_key_created_idx ON public.api_request_logs (api_key_id, created_at DESC);

CREATE TABLE public.api_webhook_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id uuid NOT NULL REFERENCES public.api_keys ON DELETE CASCADE,
  url text NOT NULL,
  secret text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.api_webhook_endpoints TO authenticated;
GRANT ALL ON public.api_webhook_endpoints TO service_role;
ALTER TABLE public.api_webhook_endpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own key webhook endpoints or admin" ON public.api_webhook_endpoints FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.api_keys k WHERE k.id = api_key_id AND k.org_id = public.current_org_id())
  );

CREATE TABLE public.api_webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id uuid NOT NULL REFERENCES public.api_webhook_endpoints ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  signature text NOT NULL,
  attempt integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending',
  response_status integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.api_webhook_deliveries TO authenticated;
GRANT ALL ON public.api_webhook_deliveries TO service_role;
ALTER TABLE public.api_webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own key webhook deliveries or admin" ON public.api_webhook_deliveries FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.api_webhook_endpoints e
      JOIN public.api_keys k ON k.id = e.api_key_id
      WHERE e.id = endpoint_id AND k.org_id = public.current_org_id()
    )
  );

-- Admin: create a key. Sandbox keys expire in 90 days, production in 12 months, matching the
-- spec's "no perpetual keys" rule regardless of what the caller passes. First production key for
-- an org requires commercial_owner + compliance_owner to be recorded (the two hard sign-offs the
-- spec calls non-negotiable; the rest of the go-live checklist is a documented follow-up).
CREATE OR REPLACE FUNCTION public.admin_api_create_key(
  p_org_id uuid,
  p_environment public.api_key_environment,
  p_name text,
  p_scopes text[] DEFAULT ARRAY['api:status_read', 'counterparty:lookup', 'counterparty:summary_read', 'usage:read'],
  p_commercial_owner text DEFAULT NULL,
  p_compliance_owner text DEFAULT NULL
)
RETURNS TABLE (id uuid, raw_key text) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_id uuid;
  v_raw text;
  v_hash text;
  v_prefix text;
  v_expires timestamptz;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorised to create an API key';
  END IF;
  IF p_environment = 'production' AND (
    p_commercial_owner IS NULL OR length(trim(p_commercial_owner)) = 0
    OR p_compliance_owner IS NULL OR length(trim(p_compliance_owner)) = 0
  ) THEN
    RAISE EXCEPTION 'A production key requires a named commercial owner and compliance owner';
  END IF;

  v_raw := p_environment::text || '_' || encode(gen_random_bytes(24), 'hex');
  -- Hash the EXACT string the client will present as the bearer token (env prefix included), so
  -- the Edge Function can hash the incoming token as-is with no prefix-stripping to get wrong.
  v_hash := encode(digest(v_raw, 'sha256'), 'hex');
  v_prefix := left(v_raw, 8);
  v_expires := now() + (CASE WHEN p_environment = 'sandbox' THEN interval '90 days' ELSE interval '12 months' END);

  INSERT INTO public.api_keys (
    environment, org_id, name, key_prefix, key_hash, scopes,
    commercial_owner, compliance_owner, created_by, expires_at
  )
  VALUES (
    p_environment, p_org_id, p_name, v_prefix, v_hash, p_scopes,
    p_commercial_owner, p_compliance_owner, auth.uid(), v_expires
  )
  RETURNING api_keys.id INTO v_id;

  RETURN QUERY SELECT v_id, v_raw;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_api_create_key(
  uuid, public.api_key_environment, text, text[], text, text
) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_api_suspend_key(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorised to suspend an API key';
  END IF;
  UPDATE public.api_keys SET status = 'suspended' WHERE id = p_id AND status = 'active';
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_api_suspend_key(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_api_reactivate_key(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorised to reactivate an API key';
  END IF;
  UPDATE public.api_keys SET status = 'active' WHERE id = p_id AND status = 'suspended';
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_api_reactivate_key(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_api_revoke_key(p_id uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorised to revoke an API key';
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'A revocation reason is required';
  END IF;
  UPDATE public.api_keys
  SET status = 'revoked', revoked_at = now(), revoked_by = auth.uid(), revoke_reason = p_reason
  WHERE id = p_id AND status <> 'revoked';
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_api_revoke_key(uuid, text) TO authenticated;

-- Rotation = revoke the old key and issue a fresh one with the same org/environment/scopes;
-- nothing about the old key's identity or logs is reused, matching "no automatic promotion" spirit.
CREATE OR REPLACE FUNCTION public.admin_api_rotate_key(p_id uuid)
RETURNS TABLE (id uuid, raw_key text) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_old record;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorised to rotate an API key';
  END IF;
  SELECT * INTO v_old FROM public.api_keys WHERE id = p_id;
  IF v_old.id IS NULL THEN
    RAISE EXCEPTION 'Key not found';
  END IF;
  UPDATE public.api_keys
  SET status = 'revoked', revoked_at = now(), revoked_by = auth.uid(), revoke_reason = 'rotated'
  WHERE api_keys.id = p_id;
  RETURN QUERY SELECT * FROM public.admin_api_create_key(
    v_old.org_id, v_old.environment, v_old.name || ' (rotated)', v_old.scopes,
    v_old.commercial_owner, v_old.compliance_owner
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_api_rotate_key(uuid) TO authenticated;
