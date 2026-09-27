CREATE TABLE public.celebrations_seen (
  user_id uuid NOT NULL DEFAULT auth.uid(),
  transaction_id uuid NOT NULL,
  kind text NOT NULL,
  seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, transaction_id, kind)
);
GRANT SELECT, INSERT ON public.celebrations_seen TO authenticated;
GRANT ALL ON public.celebrations_seen TO service_role;
ALTER TABLE public.celebrations_seen ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own celebrations read" ON public.celebrations_seen FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own celebrations insert" ON public.celebrations_seen FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);