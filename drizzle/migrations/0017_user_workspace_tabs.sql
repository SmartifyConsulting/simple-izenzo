-- Remembers, per signed-in person, which deal tabs they left open and which they closed, so the
-- taskbar stops guessing from their most recent bids and stops reopening tabs they shut on another
-- browser or device. View state only: it never touches a transaction or any governed record.
CREATE TABLE public.user_workspace_tabs (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  state text NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'closed')),
  position integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, transaction_id)
);

CREATE INDEX user_workspace_tabs_open_idx
  ON public.user_workspace_tabs (user_id, position)
  WHERE state = 'open';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_workspace_tabs TO authenticated;
GRANT ALL ON public.user_workspace_tabs TO service_role;

ALTER TABLE public.user_workspace_tabs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "People see only their own tabs"
  ON public.user_workspace_tabs FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "People record only their own tabs"
  ON public.user_workspace_tabs FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "People update only their own tabs"
  ON public.user_workspace_tabs FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "People delete only their own tabs"
  ON public.user_workspace_tabs FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));