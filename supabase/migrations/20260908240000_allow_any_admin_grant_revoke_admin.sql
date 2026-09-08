-- Reverts 20260908230000: any admin may grant or revoke the admin role again, not just
-- the named system administrator. The system administrator's own admin role still can't
-- be removed by anyone — that's enforced separately by the protect_superuser_admin_role
-- trigger from 20260908220000, which stays in place.

DROP POLICY IF EXISTS "admin insert roles" ON public.user_roles;
CREATE POLICY "admin insert roles" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admin delete roles" ON public.user_roles;
CREATE POLICY "admin delete roles" ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
