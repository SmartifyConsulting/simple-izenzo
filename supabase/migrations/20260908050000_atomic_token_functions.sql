-- SECURITY FIX: token/credit balance mutation currently happens as direct client-side
-- `UPDATE organisations SET credits = ...` + `INSERT INTO credit_ledger` calls, executed under
-- the authenticated user's own RLS grants. Because the RLS policy "update own org" allows any
-- org member to update their organisation row, any signed-in user can open devtools and grant
-- themselves unlimited tokens directly against Supabase, bypassing the UI entirely.
--
-- This matches a guardrail documented in the real platform's technical audit: all money/credit
-- moving functions must be SECURITY DEFINER, callable only through a validated RPC, never via a
-- direct table write from the client.
--
-- Fix: a single atomic RPC does the balance check + update + ledger insert under elevated
-- privilege, with its own authorization check inside the function body. Direct client writes to
-- the credits column and to credit_ledger are then revoked.

CREATE OR REPLACE FUNCTION public.atomic_token_adjust(
  p_org_id uuid,
  p_delta integer,
  p_reason text,
  p_transaction_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_member boolean;
  v_is_admin boolean;
  v_current integer;
  v_new integer;
BEGIN
  IF p_delta = 0 THEN
    RAISE EXCEPTION 'delta must not be zero';
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'reason is required';
  END IF;

  v_is_admin := public.has_role(auth.uid(), 'admin');
  v_is_member := EXISTS (
    SELECT 1 FROM public.org_members m WHERE m.org_id = p_org_id AND m.user_id = auth.uid()
  );

  IF NOT v_is_admin AND NOT v_is_member THEN
    RAISE EXCEPTION 'Not authorised to adjust tokens for this organisation';
  END IF;

  SELECT credits INTO v_current FROM public.organisations WHERE id = p_org_id FOR UPDATE;
  IF v_current IS NULL THEN
    RAISE EXCEPTION 'Organisation not found';
  END IF;

  v_new := v_current + p_delta;
  IF v_new < 0 THEN
    RAISE EXCEPTION 'Insufficient tokens';
  END IF;

  UPDATE public.organisations SET credits = v_new WHERE id = p_org_id;

  INSERT INTO public.credit_ledger (org_id, delta, reason, transaction_id, created_by)
  VALUES (p_org_id, p_delta, p_reason, p_transaction_id, auth.uid());

  RETURN v_new;
END;
$$;

GRANT EXECUTE ON FUNCTION public.atomic_token_adjust(uuid, integer, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.atomic_token_adjust(uuid, integer, text, uuid) TO service_role;

-- Lock down the direct-write paths this function replaces.
REVOKE UPDATE (credits) ON public.organisations FROM authenticated;
REVOKE INSERT ON public.credit_ledger FROM authenticated;
