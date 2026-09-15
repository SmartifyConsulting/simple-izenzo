-- Admins could see the Users list and the "Make admin" button, but granting a role to someone
-- else's user_id was rejected by RLS — only an insert matching auth.uid() = user_id (or no insert
-- policy at all) existed on user_roles, so a signed-in admin could never write a role row for a
-- different user. This adds a broad admin-managed policy alongside whatever already exists.
DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;

CREATE POLICY "Admins can manage user roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
