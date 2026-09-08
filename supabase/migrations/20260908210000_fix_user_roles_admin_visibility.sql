-- Fixes a real bug: user_roles only had a "read own roles" SELECT policy (user_id = auth.uid()).
-- Two concrete symptoms this caused:
--   1. "new row violates row-level security policy for table user_roles" when an admin granted the
--      admin role to a DIFFERENT user — Postgres re-checks the SELECT policy for the RETURNING
--      clause the Supabase client requests by default, and the target row (someone else's) failed
--      that check even though the INSERT's own WITH CHECK (has_role admin) passed correctly.
--   2. The admin Users list's "admin" badge could only ever show for the CALLER's own row — an
--      admin viewing the list could not see that a different user already had the admin role,
--      since that row was invisible to them too.
--
-- Fix: admins can read every row; everyone else still only reads their own (unchanged).
CREATE POLICY "admin reads all roles" ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
