-- 1. Structured DecisionPack proposals
DO $$ BEGIN
  CREATE TYPE public.ai_proposal_type AS ENUM ('counterparty','pricing','risk','structure','timing','substitution','bundle');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ai_proposal_decision AS ENUM ('accepted','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.ai_proposals
  ADD COLUMN IF NOT EXISTS decision_pack_id uuid,
  ADD COLUMN IF NOT EXISTS proposal_type public.ai_proposal_type,
  ADD COLUMN IF NOT EXISTS probability numeric,
  ADD COLUMN IF NOT EXISTS rationale text,
  ADD COLUMN IF NOT EXISTS source_references jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS stage_context text,
  ADD COLUMN IF NOT EXISTS decided_by uuid,
  ADD COLUMN IF NOT EXISTS decided_at timestamptz,
  ADD COLUMN IF NOT EXISTS decision public.ai_proposal_decision,
  ADD COLUMN IF NOT EXISTS superseded_by uuid;

DO $$ BEGIN
  ALTER TABLE public.ai_proposals
    ADD CONSTRAINT ai_proposals_probability_range CHECK (probability IS NULL OR (probability >= 0 AND probability <= 1));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS ai_proposals_pack_idx ON public.ai_proposals (decision_pack_id);
CREATE INDEX IF NOT EXISTS ai_proposals_stage_idx ON public.ai_proposals (transaction_id, stage_context);

-- 2. Proof of Intent immutability + frozen finality
CREATE OR REPLACE FUNCTION public.protect_sealed_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_finality boolean;
BEGIN
  IF OLD.poi_sealed_at IS NOT NULL THEN
    IF NEW.poi_sealed_at IS DISTINCT FROM OLD.poi_sealed_at
       OR NEW.poi_hash IS DISTINCT FROM OLD.poi_hash
       OR NEW.intent_confirmed_at IS DISTINCT FROM OLD.intent_confirmed_at THEN
      RAISE EXCEPTION 'The Proof of Intent is sealed and cannot be changed or re-opened';
    END IF;
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.finality_records f WHERE f.transaction_id = OLD.id)
    INTO has_finality;
  IF has_finality AND (
      NEW.poi_sealed_at IS DISTINCT FROM OLD.poi_sealed_at
      OR NEW.poi_hash IS DISTINCT FROM OLD.poi_hash
      OR NEW.intent_confirmed_at IS DISTINCT FROM OLD.intent_confirmed_at
      OR NEW.wad_completed_at IS DISTINCT FROM OLD.wad_completed_at
      OR NEW.stage IS DISTINCT FROM OLD.stage
      OR NEW.step IS DISTINCT FROM OLD.step
      OR NEW.status IS DISTINCT FROM OLD.status
  ) THEN
    RAISE EXCEPTION 'Finality is recorded for this transaction — its record is frozen';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_sealed_tx ON public.transactions;
CREATE TRIGGER protect_sealed_tx
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.protect_sealed_transaction();

-- 3. WaD is a non-waivable gate before execution and finality
CREATE OR REPLACE FUNCTION public.require_wad_before_stage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  poi timestamptz;
  wad timestamptz;
BEGIN
  SELECT t.poi_sealed_at, t.wad_completed_at INTO poi, wad
  FROM public.transactions t WHERE t.id = NEW.transaction_id;
  IF poi IS NULL THEN
    RAISE EXCEPTION 'Proof of Intent must be sealed first';
  END IF;
  IF wad IS NULL THEN
    RAISE EXCEPTION 'Without a Doubt verification must be complete first';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS require_wad_execution ON public.execution_records;
CREATE TRIGGER require_wad_execution
  BEFORE INSERT ON public.execution_records
  FOR EACH ROW EXECUTE FUNCTION public.require_wad_before_stage();

DROP TRIGGER IF EXISTS require_wad_finality ON public.finality_records;
CREATE TRIGGER require_wad_finality
  BEFORE INSERT ON public.finality_records
  FOR EACH ROW EXECUTE FUNCTION public.require_wad_before_stage();

-- 4. A decided proposal is a settled business event: it may not be re-decided or edited
CREATE OR REPLACE FUNCTION public.protect_decided_proposal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.decided_at IS NOT NULL AND (
      NEW.decision IS DISTINCT FROM OLD.decision
      OR NEW.decided_by IS DISTINCT FROM OLD.decided_by
      OR NEW.decided_at IS DISTINCT FROM OLD.decided_at
      OR NEW.probability IS DISTINCT FROM OLD.probability
      OR NEW.output IS DISTINCT FROM OLD.output
  ) THEN
    RAISE EXCEPTION 'This proposal has already been decided and cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_decided_proposal ON public.ai_proposals;
CREATE TRIGGER protect_decided_proposal
  BEFORE UPDATE ON public.ai_proposals
  FOR EACH ROW EXECUTE FUNCTION public.protect_decided_proposal();

GRANT SELECT, INSERT, UPDATE ON public.ai_proposals TO authenticated;
GRANT ALL ON public.ai_proposals TO service_role;