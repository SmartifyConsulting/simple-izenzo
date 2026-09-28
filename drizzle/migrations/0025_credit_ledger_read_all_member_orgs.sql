DROP POLICY IF EXISTS "read credits" ON public.credit_ledger;
CREATE POLICY "read credits" ON public.credit_ledger FOR SELECT TO authenticated
USING (org_id IN (SELECT m.org_id FROM public.org_members m WHERE m.user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));