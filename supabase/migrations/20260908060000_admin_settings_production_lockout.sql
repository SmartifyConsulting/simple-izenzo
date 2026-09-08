-- Platform-wide guardrail from the rebuild requirements (section 0): a test-mode bypass flag that
-- is forced off in production, and a billing-availability flag so payments can be fully disabled
-- without removing UI. Build this in now, before any feature depends on assuming it's always on.

CREATE TABLE public.admin_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_settings TO authenticated;
GRANT ALL ON public.admin_settings TO service_role;
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read settings" ON public.admin_settings FOR SELECT TO authenticated USING (true);

-- Only admins may change settings, and only through this RPC (no direct table writes from clients).
CREATE OR REPLACE FUNCTION public.admin_set_setting(p_key text, p_value jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorised to change platform settings';
  END IF;
  INSERT INTO public.admin_settings (key, value, updated_by, updated_at)
  VALUES (p_key, p_value, auth.uid(), now())
  ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = excluded.updated_at;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_set_setting(text, jsonb) TO authenticated;

-- Seed defaults: test-mode bypass off, billing not yet available.
INSERT INTO public.admin_settings (key, value) VALUES
  ('test_mode_bypass', '{"enabled": false}'::jsonb),
  ('billing_availability', '{"enabled": false, "reason": "not_yet_configured"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- RLS predicate helpers (class D in the audit's terminology): read-only, safe for any authenticated
-- caller, used to gate behaviour rather than authorise a mutation.
CREATE OR REPLACE FUNCTION public.is_test_mode_bypass_enabled()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE((SELECT (value->>'enabled')::boolean FROM public.admin_settings WHERE key = 'test_mode_bypass'), false)
$$;

CREATE OR REPLACE FUNCTION public.is_billing_available()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE((SELECT (value->>'enabled')::boolean FROM public.admin_settings WHERE key = 'billing_availability'), false)
$$;

GRANT EXECUTE ON FUNCTION public.is_test_mode_bypass_enabled() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_billing_available() TO authenticated;
