CREATE TABLE public.case_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  file_name text,
  storage_path text,
  source text,
  note text,
  sha256 text,
  added_by uuid NOT NULL DEFAULT auth.uid(),
  added_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.case_evidence TO authenticated;
GRANT ALL ON public.case_evidence TO service_role;
ALTER TABLE public.case_evidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "case evidence read" ON public.case_evidence FOR SELECT TO authenticated USING (public.can_access_tx(transaction_id));
CREATE POLICY "case evidence add" ON public.case_evidence FOR INSERT TO authenticated WITH CHECK (public.can_access_tx(transaction_id) AND added_by = auth.uid());

CREATE TABLE public.case_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  direction text NOT NULL,
  title text NOT NULL,
  reason text,
  evidence_basis text,
  expected_result text,
  effect text,
  authority_required text,
  decision text CHECK (decision IN ('accepted','rejected')),
  decided_by uuid,
  decided_by_name text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.case_leads TO authenticated;
GRANT ALL ON public.case_leads TO service_role;
ALTER TABLE public.case_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "case leads read" ON public.case_leads FOR SELECT TO authenticated USING (public.can_access_tx(transaction_id));
CREATE POLICY "case leads add" ON public.case_leads FOR INSERT TO authenticated WITH CHECK (public.can_access_tx(transaction_id) AND decision IS NULL);
CREATE POLICY "case leads decide" ON public.case_leads FOR UPDATE TO authenticated USING (public.can_access_tx(transaction_id)) WITH CHECK (public.can_access_tx(transaction_id));

CREATE OR REPLACE FUNCTION public.protect_case_lead() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.decision IS NOT NULL THEN RAISE EXCEPTION 'This lead has already been decided'; END IF;
  IF NEW.decision IS NULL OR NEW.decided_by IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'A decision must be attributed to the signed-in investigator'; END IF;
  IF NEW.direction <> OLD.direction OR NEW.title <> OLD.title OR NEW.reason IS DISTINCT FROM OLD.reason THEN RAISE EXCEPTION 'AI+ proposals cannot be edited'; END IF;
  NEW.decided_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER case_leads_protect BEFORE UPDATE ON public.case_leads FOR EACH ROW EXECUTE FUNCTION public.protect_case_lead();

CREATE TABLE public.case_wad_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  check_key text NOT NULL,
  passed boolean NOT NULL,
  note text,
  recorded_by uuid NOT NULL DEFAULT auth.uid(),
  recorded_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.case_wad_checks TO authenticated;
GRANT ALL ON public.case_wad_checks TO service_role;
ALTER TABLE public.case_wad_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "case wad read" ON public.case_wad_checks FOR SELECT TO authenticated USING (public.can_access_tx(transaction_id));
CREATE POLICY "case wad add" ON public.case_wad_checks FOR INSERT TO authenticated WITH CHECK (public.can_access_tx(transaction_id) AND recorded_by = auth.uid());

CREATE TABLE public.case_closures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL UNIQUE REFERENCES public.transactions(id) ON DELETE CASCADE,
  outcome text NOT NULL CHECK (outcome IN ('actioned','no_further_action','referred')),
  note text,
  summary text,
  follow_up_transaction_id uuid REFERENCES public.transactions(id),
  closed_by uuid NOT NULL DEFAULT auth.uid(),
  closed_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.case_closures TO authenticated;
GRANT ALL ON public.case_closures TO service_role;
ALTER TABLE public.case_closures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "case closure read" ON public.case_closures FOR SELECT TO authenticated USING (public.can_access_tx(transaction_id));
CREATE POLICY "case closure add" ON public.case_closures FOR INSERT TO authenticated WITH CHECK (public.can_access_tx(transaction_id) AND closed_by = auth.uid());

CREATE OR REPLACE FUNCTION public.require_case_wad() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE missing int;
BEGIN
  SELECT count(*) INTO missing FROM unnest(ARRAY['agency','mandate','jurisdiction','legal_authority','chain_of_custody']) k
  WHERE NOT EXISTS (
    SELECT 1 FROM public.case_wad_checks c WHERE c.transaction_id = NEW.transaction_id AND c.check_key = k
      AND c.passed AND c.created_at = (SELECT max(c2.created_at) FROM public.case_wad_checks c2 WHERE c2.transaction_id = NEW.transaction_id AND c2.check_key = k)
  );
  IF missing > 0 THEN RAISE EXCEPTION 'Without a Doubt checks must all pass before the case can be closed'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER case_closures_require_wad BEFORE INSERT ON public.case_closures FOR EACH ROW EXECUTE FUNCTION public.require_case_wad();