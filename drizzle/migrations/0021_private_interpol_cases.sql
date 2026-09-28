CREATE OR REPLACE FUNCTION public.admin_can_see_tx_org(_org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.has_role(auth.uid(),'admin') AND (
    NOT EXISTS (SELECT 1 FROM public.organisations o WHERE o.id = _org AND o.workflow_template_key = 'interpol_investigation')
    OR EXISTS (SELECT 1 FROM public.org_members m WHERE m.org_id = _org AND m.user_id = auth.uid())
  )
$$;

CREATE OR REPLACE FUNCTION public.can_access_tx(_tx uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.id = _tx
      AND (t.org_id = public.current_org_id()
        OR t.counterparty_org_id = public.current_org_id()
        OR EXISTS (SELECT 1 FROM public.org_members m WHERE m.org_id = t.org_id AND m.user_id = auth.uid())
        OR public.admin_can_see_tx_org(t.org_id))
  )
$$;

DROP POLICY IF EXISTS "read tx" ON public.transactions;
CREATE POLICY "read tx" ON public.transactions FOR SELECT
USING (org_id = current_org_id() OR counterparty_org_id = current_org_id() OR public.admin_can_see_tx_org(org_id));

DROP POLICY IF EXISTS "update tx" ON public.transactions;
CREATE POLICY "update tx" ON public.transactions FOR UPDATE
USING (org_id = current_org_id() OR counterparty_org_id = current_org_id() OR public.admin_can_see_tx_org(org_id));