-- Counterparty Rating Methodology v1.0 (rebuild requirements section 16). Informational only for
-- search/POI; never a substitute for the actual compliance gates. Computed once when the score is
-- set (not recalculated on every page view), overridable only by platform_admin with a reason,
-- audited, versioned so a past rating can always be explained against the methodology that
-- produced it.

CREATE TYPE public.counterparty_rating_band AS ENUM ('trusted', 'neutral', 'flagged');

ALTER TABLE public.counterparties
  ADD COLUMN IF NOT EXISTS rating_band public.counterparty_rating_band,
  ADD COLUMN IF NOT EXISTS rating_version text NOT NULL DEFAULT 'Counterparty Rating Methodology v1.0',
  ADD COLUMN IF NOT EXISTS rating_computed_at timestamptz,
  ADD COLUMN IF NOT EXISTS rating_override public.counterparty_rating_band,
  ADD COLUMN IF NOT EXISTS rating_override_reason text,
  ADD COLUMN IF NOT EXISTS rating_override_by uuid,
  ADD COLUMN IF NOT EXISTS rating_override_at timestamptz,
  ADD COLUMN IF NOT EXISTS rating_override_expiry timestamptz;

-- Computed once on insert, and again only when the score itself changes — never on read.
CREATE OR REPLACE FUNCTION public.compute_counterparty_rating()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.score IS DISTINCT FROM OLD.score THEN
    NEW.rating_band := CASE
      WHEN NEW.score IS NULL THEN NULL
      WHEN NEW.score >= 70 THEN 'trusted'::public.counterparty_rating_band
      WHEN NEW.score >= 40 THEN 'neutral'::public.counterparty_rating_band
      ELSE 'flagged'::public.counterparty_rating_band
    END;
    NEW.rating_computed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER counterparty_rating_trigger
  BEFORE INSERT OR UPDATE ON public.counterparties
  FOR EACH ROW EXECUTE FUNCTION public.compute_counterparty_rating();

-- Backfill existing rows once.
UPDATE public.counterparties SET score = score WHERE score IS NOT NULL;

REVOKE UPDATE (rating_override, rating_override_reason, rating_override_by, rating_override_at, rating_override_expiry)
  ON public.counterparties FROM authenticated;

CREATE OR REPLACE FUNCTION public.admin_override_counterparty_rating(
  p_counterparty_id uuid,
  p_override public.counterparty_rating_band,
  p_reason text,
  p_expiry timestamptz DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorised to override a counterparty rating';
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'An override reason is required';
  END IF;
  UPDATE public.counterparties
  SET rating_override = p_override,
      rating_override_reason = p_reason,
      rating_override_by = auth.uid(),
      rating_override_at = now(),
      rating_override_expiry = p_expiry
  WHERE id = p_counterparty_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_override_counterparty_rating(uuid, public.counterparty_rating_band, text, timestamptz) TO authenticated;
