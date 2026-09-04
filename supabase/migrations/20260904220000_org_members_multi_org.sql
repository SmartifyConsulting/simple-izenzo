-- ORG MEMBERSHIP (a user can belong to more than one organisation)
CREATE TABLE public.org_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'owner',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_members TO authenticated;
GRANT ALL ON public.org_members TO service_role;
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;

-- backfill: every profile with an org today becomes an "owner" member of it
INSERT INTO public.org_members (org_id, user_id, role)
SELECT org_id, id, 'owner' FROM public.profiles WHERE org_id IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE POLICY "read own memberships" ON public.org_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "insert own membership" ON public.org_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "delete own membership" ON public.org_members FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- members can see and update any org they belong to, not only the active one
CREATE POLICY "read member orgs" ON public.organisations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.org_members m WHERE m.org_id = organisations.id AND m.user_id = auth.uid()));
CREATE POLICY "update member orgs" ON public.organisations FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.org_members m WHERE m.org_id = organisations.id AND m.user_id = auth.uid()) OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.org_members m WHERE m.org_id = organisations.id AND m.user_id = auth.uid()) OR public.has_role(auth.uid(),'admin'));

-- members can read the credit ledger of any org they belong to
CREATE POLICY "read member credits" ON public.credit_ledger FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.org_members m WHERE m.org_id = credit_ledger.org_id AND m.user_id = auth.uid()));

-- admins can grant/revoke roles from the new System Admin > Users screen
GRANT INSERT, DELETE ON public.user_roles TO authenticated;
CREATE POLICY "admin insert roles" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin delete roles" ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- admins can read every profile for the Users screen
CREATE POLICY "admin read all profiles" ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
