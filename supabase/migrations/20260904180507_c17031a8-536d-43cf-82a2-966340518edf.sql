ALTER TABLE public.organisations ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid();

DROP POLICY IF EXISTS "read own org" ON public.organisations;
CREATE POLICY "read own org" ON public.organisations
FOR SELECT TO authenticated
USING (
  id = public.current_org_id()
  OR created_by = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE (t.org_id = public.organisations.id OR t.counterparty_org_id = public.organisations.id)
      AND (t.org_id = public.current_org_id() OR t.counterparty_org_id = public.current_org_id())
  )
);

DROP POLICY IF EXISTS "update own org" ON public.organisations;
CREATE POLICY "update own org" ON public.organisations
FOR UPDATE TO authenticated
USING (id = public.current_org_id() OR created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (id = public.current_org_id() OR created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));