ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS transaction_id uuid REFERENCES public.transactions(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS notifications_transaction_id_idx ON public.notifications (transaction_id);