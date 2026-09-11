ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS document_summary text,
  ADD COLUMN IF NOT EXISTS document_summary_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS id_number_encrypted text;