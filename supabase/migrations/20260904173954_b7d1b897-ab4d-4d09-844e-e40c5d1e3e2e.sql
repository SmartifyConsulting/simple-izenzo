-- ENUMS
CREATE TYPE public.app_role AS ENUM ('party','counterparty','admin');
CREATE TYPE public.spine_stage AS ENUM ('trading','compliance','execution','finality','memory');

-- ORGANISATIONS
CREATE TABLE public.organisations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  registration_no text,
  country text,
  sector text,
  address text,
  credits integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organisations TO authenticated;
GRANT ALL ON public.organisations TO service_role;
ALTER TABLE public.organisations ENABLE ROW LEVEL SECURITY;

-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email text,
  full_name text,
  org_id uuid REFERENCES public.organisations ON DELETE SET NULL,
  seat text NOT NULL DEFAULT 'party',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ROLES
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT org_id FROM public.profiles WHERE id = auth.uid()
$$;

-- TRANSACTIONS
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations ON DELETE CASCADE,
  counterparty_org_id uuid REFERENCES public.organisations ON DELETE SET NULL,
  title text NOT NULL,
  commodity text,
  quantity numeric,
  unit text,
  price numeric,
  currency text NOT NULL DEFAULT 'USD',
  incoterms text,
  jurisdiction text,
  stage public.spine_stage NOT NULL DEFAULT 'trading',
  step text NOT NULL DEFAULT 'bid_offer',
  status text NOT NULL DEFAULT 'open',
  intent_confirmed_at timestamptz,
  poi_sealed_at timestamptz,
  poi_hash text,
  wad_completed_at timestamptz,
  finality_sealed_at timestamptz,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_access_tx(_tx uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.id = _tx
      AND (t.org_id = public.current_org_id()
        OR t.counterparty_org_id = public.current_org_id()
        OR public.has_role(auth.uid(),'admin'))
  )
$$;

-- EVENTS (append only)
CREATE TABLE public.transaction_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.transactions ON DELETE CASCADE,
  actor_id uuid NOT NULL DEFAULT auth.uid(),
  actor_name text,
  stage public.spine_stage NOT NULL,
  step text NOT NULL,
  action text NOT NULL,
  summary text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  fingerprint text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.transaction_events TO authenticated;
GRANT ALL ON public.transaction_events TO service_role;
ALTER TABLE public.transaction_events ENABLE ROW LEVEL SECURITY;

-- BIDS / OFFERS
CREATE TABLE public.bid_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.transactions ON DELETE CASCADE,
  direction text NOT NULL DEFAULT 'bid',
  price numeric,
  quantity numeric,
  unit text,
  currency text NOT NULL DEFAULT 'USD',
  terms text,
  status text NOT NULL DEFAULT 'sent',
  submitted_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bid_offers TO authenticated;
GRANT ALL ON public.bid_offers TO service_role;
ALTER TABLE public.bid_offers ENABLE ROW LEVEL SECURITY;

-- DOCUMENTS
CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.transactions ON DELETE CASCADE,
  name text NOT NULL,
  doc_type text NOT NULL DEFAULT 'other',
  version integer NOT NULL DEFAULT 1,
  sha256 text,
  storage_path text,
  notes text,
  uploaded_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- COUNTERPARTIES
CREATE TABLE public.counterparties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.transactions ON DELETE CASCADE,
  name text NOT NULL,
  jurisdiction text,
  sector text,
  score numeric,
  source text,
  rationale text,
  media_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'surfaced',
  chosen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.counterparties TO authenticated;
GRANT ALL ON public.counterparties TO service_role;
ALTER TABLE public.counterparties ENABLE ROW LEVEL SECURITY;

-- AI PROPOSALS
CREATE TABLE public.ai_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.transactions ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'ai',
  prompt text,
  output text,
  model text,
  adopted_by uuid,
  adopted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_proposals TO authenticated;
GRANT ALL ON public.ai_proposals TO service_role;
ALTER TABLE public.ai_proposals ENABLE ROW LEVEL SECURITY;

-- CREDIT LEDGER
CREATE TABLE public.credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations ON DELETE CASCADE,
  delta integer NOT NULL,
  reason text NOT NULL,
  transaction_id uuid REFERENCES public.transactions ON DELETE SET NULL,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.credit_ledger TO authenticated;
GRANT ALL ON public.credit_ledger TO service_role;
ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;

-- WAD CASES
CREATE TABLE public.wad_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.transactions ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'open',
  kyc jsonb NOT NULL DEFAULT '{}'::jsonb,
  kyb jsonb NOT NULL DEFAULT '{}'::jsonb,
  ubo jsonb NOT NULL DEFAULT '{}'::jsonb,
  sanctions jsonb NOT NULL DEFAULT '{}'::jsonb,
  pep jsonb NOT NULL DEFAULT '{}'::jsonb,
  authority jsonb NOT NULL DEFAULT '{}'::jsonb,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wad_cases TO authenticated;
GRANT ALL ON public.wad_cases TO service_role;
ALTER TABLE public.wad_cases ENABLE ROW LEVEL SECURITY;

-- EXECUTION RECORDS
CREATE TABLE public.execution_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.transactions ON DELETE CASCADE,
  phase text NOT NULL,
  prep_stage text,
  status text NOT NULL DEFAULT 'recorded',
  notes text,
  recorded_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.execution_records TO authenticated;
GRANT ALL ON public.execution_records TO service_role;
ALTER TABLE public.execution_records ENABLE ROW LEVEL SECURITY;

-- STAKEHOLDER EVENTS
CREATE TABLE public.stakeholder_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.transactions ON DELETE CASCADE,
  event_type text NOT NULL,
  party_name text NOT NULL,
  role text,
  notes text,
  recorded_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stakeholder_events TO authenticated;
GRANT ALL ON public.stakeholder_events TO service_role;
ALTER TABLE public.stakeholder_events ENABLE ROW LEVEL SECURITY;

-- FINALITY
CREATE TABLE public.finality_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.transactions ON DELETE CASCADE,
  finality_type text,
  evidence text,
  change_event text,
  validation text,
  status text NOT NULL DEFAULT 'draft',
  hash text,
  sealed_at timestamptz,
  recorded_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finality_records TO authenticated;
GRANT ALL ON public.finality_records TO service_role;
ALTER TABLE public.finality_records ENABLE ROW LEVEL SECURITY;

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organisations ON DELETE CASCADE,
  user_id uuid,
  title text NOT NULL,
  body text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- POLICIES
CREATE POLICY "own profile" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR org_id = public.current_org_id() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "read own org" ON public.organisations FOR SELECT TO authenticated
  USING (id = public.current_org_id() OR public.has_role(auth.uid(),'admin')
    OR EXISTS (SELECT 1 FROM public.transactions t WHERE (t.org_id = id OR t.counterparty_org_id = id) AND (t.org_id = public.current_org_id() OR t.counterparty_org_id = public.current_org_id())));
CREATE POLICY "create org" ON public.organisations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update own org" ON public.organisations FOR UPDATE TO authenticated
  USING (id = public.current_org_id() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (id = public.current_org_id() OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "read tx" ON public.transactions FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() OR counterparty_org_id = public.current_org_id() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "create tx" ON public.transactions FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id());
CREATE POLICY "update tx" ON public.transactions FOR UPDATE TO authenticated
  USING (org_id = public.current_org_id() OR counterparty_org_id = public.current_org_id() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (org_id = public.current_org_id() OR counterparty_org_id = public.current_org_id() OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "read events" ON public.transaction_events FOR SELECT TO authenticated USING (public.can_access_tx(transaction_id));
CREATE POLICY "append events" ON public.transaction_events FOR INSERT TO authenticated WITH CHECK (public.can_access_tx(transaction_id) AND actor_id = auth.uid());

CREATE POLICY "read bids" ON public.bid_offers FOR SELECT TO authenticated USING (public.can_access_tx(transaction_id));
CREATE POLICY "write bids" ON public.bid_offers FOR INSERT TO authenticated WITH CHECK (public.can_access_tx(transaction_id));
CREATE POLICY "update bids" ON public.bid_offers FOR UPDATE TO authenticated USING (public.can_access_tx(transaction_id)) WITH CHECK (public.can_access_tx(transaction_id));

CREATE POLICY "read docs" ON public.documents FOR SELECT TO authenticated USING (public.can_access_tx(transaction_id));
CREATE POLICY "write docs" ON public.documents FOR INSERT TO authenticated WITH CHECK (public.can_access_tx(transaction_id));
CREATE POLICY "update docs" ON public.documents FOR UPDATE TO authenticated USING (public.can_access_tx(transaction_id)) WITH CHECK (public.can_access_tx(transaction_id));
CREATE POLICY "delete docs" ON public.documents FOR DELETE TO authenticated USING (public.can_access_tx(transaction_id));

CREATE POLICY "read cps" ON public.counterparties FOR SELECT TO authenticated USING (public.can_access_tx(transaction_id));
CREATE POLICY "write cps" ON public.counterparties FOR INSERT TO authenticated WITH CHECK (public.can_access_tx(transaction_id));
CREATE POLICY "update cps" ON public.counterparties FOR UPDATE TO authenticated USING (public.can_access_tx(transaction_id)) WITH CHECK (public.can_access_tx(transaction_id));

CREATE POLICY "read ai" ON public.ai_proposals FOR SELECT TO authenticated USING (public.can_access_tx(transaction_id));
CREATE POLICY "write ai" ON public.ai_proposals FOR INSERT TO authenticated WITH CHECK (public.can_access_tx(transaction_id));
CREATE POLICY "update ai" ON public.ai_proposals FOR UPDATE TO authenticated USING (public.can_access_tx(transaction_id)) WITH CHECK (public.can_access_tx(transaction_id));

CREATE POLICY "read credits" ON public.credit_ledger FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "write credits" ON public.credit_ledger FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id() OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "read wad" ON public.wad_cases FOR SELECT TO authenticated USING (public.can_access_tx(transaction_id));
CREATE POLICY "write wad" ON public.wad_cases FOR INSERT TO authenticated WITH CHECK (public.can_access_tx(transaction_id));
CREATE POLICY "update wad" ON public.wad_cases FOR UPDATE TO authenticated USING (public.can_access_tx(transaction_id)) WITH CHECK (public.can_access_tx(transaction_id));

CREATE POLICY "read exec" ON public.execution_records FOR SELECT TO authenticated USING (public.can_access_tx(transaction_id));
CREATE POLICY "write exec" ON public.execution_records FOR INSERT TO authenticated WITH CHECK (public.can_access_tx(transaction_id));
CREATE POLICY "update exec" ON public.execution_records FOR UPDATE TO authenticated USING (public.can_access_tx(transaction_id)) WITH CHECK (public.can_access_tx(transaction_id));

CREATE POLICY "read stake" ON public.stakeholder_events FOR SELECT TO authenticated USING (public.can_access_tx(transaction_id));
CREATE POLICY "write stake" ON public.stakeholder_events FOR INSERT TO authenticated WITH CHECK (public.can_access_tx(transaction_id));

CREATE POLICY "read fin" ON public.finality_records FOR SELECT TO authenticated USING (public.can_access_tx(transaction_id));
CREATE POLICY "write fin" ON public.finality_records FOR INSERT TO authenticated WITH CHECK (public.can_access_tx(transaction_id));
CREATE POLICY "update fin" ON public.finality_records FOR UPDATE TO authenticated USING (public.can_access_tx(transaction_id)) WITH CHECK (public.can_access_tx(transaction_id));

CREATE POLICY "read notifs" ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR org_id = public.current_org_id() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "write notifs" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update notifs" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR org_id = public.current_org_id()) WITH CHECK (true);

-- new user handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'party') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER touch_orgs BEFORE UPDATE ON public.organisations FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_profiles BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_tx BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();