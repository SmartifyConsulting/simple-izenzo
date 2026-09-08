-- Only georgia.adams@smartify.co.za may grant or revoke the admin role for any account.
-- Other roles (party, counterparty, funder, auditor) are unaffected — any existing admin
-- can still manage those. This replaces the broader "any admin can grant/revoke admin"
-- policies from 20260908220000.

DROP POLICY IF EXISTS "admin insert roles" ON public.user_roles;
CREATE POLICY "admin insert roles" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    AND (
      role <> 'admin'
      OR EXISTS (SELECT 1 FROM auth.users u WHERE u.id = auth.uid() AND u.email = 'georgia.adams@smartify.co.za')
    )
  );

DROP POLICY IF EXISTS "admin delete roles" ON public.user_roles;
CREATE POLICY "admin delete roles" ON public.user_roles FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    AND (
      role <> 'admin'
      OR EXISTS (SELECT 1 FROM auth.users u WHERE u.id = auth.uid() AND u.email = 'georgia.adams@smartify.co.za')
    )
  );
