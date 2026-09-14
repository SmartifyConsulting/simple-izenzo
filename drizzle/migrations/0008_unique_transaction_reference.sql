CREATE UNIQUE INDEX IF NOT EXISTS transactions_reference_unique_idx
  ON public.transactions (reference)
  WHERE reference IS NOT NULL;