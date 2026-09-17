-- Remove the redundant plain index on transactions.reference.
-- transactions_reference_unique_idx (unique, partial) already covers every
-- lookup on this column; the plain duplicate only adds write cost.
DROP INDEX IF EXISTS public.transactions_reference_idx;