CREATE OR REPLACE FUNCTION public.can_access_tx(_tx uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.id = _tx
      AND (t.org_id = public.current_org_id()
        OR t.counterparty_org_id = public.current_org_id()
        OR EXISTS (SELECT 1 FROM public.org_members m WHERE m.org_id = t.org_id AND m.user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.org_members m WHERE m.org_id = t.counterparty_org_id AND m.user_id = auth.uid())
        OR public.admin_can_see_tx_org(t.org_id))
  )
$function$;