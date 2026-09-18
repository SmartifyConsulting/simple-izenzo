-- 1. org_members: enable row level security with membership-scoped policies.
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_members TO authenticated;
GRANT ALL ON public.org_members TO service_role;

DROP POLICY IF EXISTS "read own org memberships" ON public.org_members;
CREATE POLICY "read own org memberships"
  ON public.org_members FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR org_id = public.current_org_id()
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "join org as self" ON public.org_members;
CREATE POLICY "join org as self"
  ON public.org_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins manage memberships" ON public.org_members;
CREATE POLICY "admins manage memberships"
  ON public.org_members FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "leave own org or admin removes" ON public.org_members;
CREATE POLICY "leave own org or admin removes"
  ON public.org_members FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- 2. admin_settings: configuration is administrator-only, not every signed-in user.
DROP POLICY IF EXISTS "read settings" ON public.admin_settings;
CREATE POLICY "admins read settings"
  ON public.admin_settings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3. bug_reports: a reporter sees their own reports; administrators see all.
DROP POLICY IF EXISTS "Authenticated users can view bug reports" ON public.bug_reports;
CREATE POLICY "Users view own bug reports or admins view all"
  ON public.bug_reports FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- 4. notifications: an insert must be for the caller, their own organisation, or a
-- transaction the caller is already party to (counter offers, cancellations, messages).
DROP POLICY IF EXISTS "write notifs" ON public.notifications;
CREATE POLICY "write notifs"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR org_id = public.current_org_id()
    OR (transaction_id IS NOT NULL AND public.can_access_tx(transaction_id))
    OR public.has_role(auth.uid(), 'admin')
  );

-- 5. Pin a fixed search_path on the two functions that still had a mutable one.
ALTER FUNCTION public.compute_counterparty_rating() SET search_path = public;
ALTER FUNCTION public.export_full_database() SET search_path = public;

-- 6. No database routine is callable without signing in, and internal/trigger-only
-- routines are not callable over the API at all.
DO $$
DECLARE
  f record;
  internal_only text[] := ARRAY[
    'export_full_database',
    'compute_counterparty_rating',
    'handle_new_user',
    'protect_decided_proposal',
    'protect_sealed_transaction',
    'protect_superuser_admin_role',
    'require_wad_before_stage',
    'touch_integration_credentials',
    'touch_updated_at',
    'mark_email_verified_if_oauth'
  ];
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, PUBLIC', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
    IF f.proname = ANY (internal_only) THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', f.sig);
    ELSE
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f.sig);
    END IF;
  END LOOP;
END $$;
