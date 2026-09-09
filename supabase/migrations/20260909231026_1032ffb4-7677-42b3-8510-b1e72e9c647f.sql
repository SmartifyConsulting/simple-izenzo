ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS reference text;
CREATE INDEX IF NOT EXISTS transactions_reference_idx ON public.transactions (reference);

CREATE OR REPLACE FUNCTION public.deal_fallback_reference(_id text, _direction text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  h bigint := 0;
  i int;
  base bigint;
BEGIN
  FOR i IN 1..length(_id) LOOP
    h := (h * 31 + ascii(substr(_id, i, 1))) % 4294967296;
  END LOOP;
  base := CASE WHEN _direction = 'offer' THEN 8979667 ELSE 9088778 END;
  RETURN CASE WHEN _direction = 'offer' THEN 'OFF' ELSE 'BID' END || (base + (h % 1000))::text;
END;
$$;

UPDATE public.transactions t
SET reference = public.deal_fallback_reference(
  t.id::text,
  COALESCE((
    SELECT b.direction FROM public.bid_offers b
    WHERE b.transaction_id = t.id
    ORDER BY b.created_at ASC
    LIMIT 1
  ), 'bid')
)
WHERE t.reference IS NULL;