-- Performance only: no change to access decisions or business rules.

-- 1. Missing indexes on frequently filtered foreign-key columns.
CREATE INDEX IF NOT EXISTS counterparties_transaction_id_idx
  ON public.counterparties (transaction_id);

CREATE INDEX IF NOT EXISTS counterparties_tx_shortlisted_score_idx
  ON public.counterparties (transaction_id, shortlisted, score DESC);

CREATE INDEX IF NOT EXISTS transaction_events_tx_created_idx
  ON public.transaction_events (transaction_id, created_at DESC);

CREATE INDEX IF NOT EXISTS documents_transaction_id_idx
  ON public.documents (transaction_id);

CREATE INDEX IF NOT EXISTS bid_offers_transaction_id_idx
  ON public.bid_offers (transaction_id);

CREATE INDEX IF NOT EXISTS transactions_org_created_by_created_idx
  ON public.transactions (org_id, created_by, created_at DESC);

-- 2. RLS: evaluate the access check once per query (InitPlan) instead of per row.
--    Predicates are byte-for-byte equivalent; only the wrapping changes.
DROP POLICY IF EXISTS "read cps" ON public.counterparties;
CREATE POLICY "read cps" ON public.counterparties FOR SELECT TO authenticated
  USING ((SELECT public.can_access_tx(transaction_id)));
DROP POLICY IF EXISTS "update cps" ON public.counterparties;
CREATE POLICY "update cps" ON public.counterparties FOR UPDATE TO authenticated
  USING ((SELECT public.can_access_tx(transaction_id)))
  WITH CHECK ((SELECT public.can_access_tx(transaction_id)));
DROP POLICY IF EXISTS "write cps" ON public.counterparties;
CREATE POLICY "write cps" ON public.counterparties FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.can_access_tx(transaction_id)));

DROP POLICY IF EXISTS "read events" ON public.transaction_events;
CREATE POLICY "read events" ON public.transaction_events FOR SELECT TO authenticated
  USING ((SELECT public.can_access_tx(transaction_id)));
DROP POLICY IF EXISTS "append events" ON public.transaction_events;
CREATE POLICY "append events" ON public.transaction_events FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.can_access_tx(transaction_id)) AND actor_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "read docs" ON public.documents;
CREATE POLICY "read docs" ON public.documents FOR SELECT TO authenticated
  USING ((SELECT public.can_access_tx(transaction_id)));
DROP POLICY IF EXISTS "update docs" ON public.documents;
CREATE POLICY "update docs" ON public.documents FOR UPDATE TO authenticated
  USING ((SELECT public.can_access_tx(transaction_id)))
  WITH CHECK ((SELECT public.can_access_tx(transaction_id)));
DROP POLICY IF EXISTS "delete docs" ON public.documents;
CREATE POLICY "delete docs" ON public.documents FOR DELETE TO authenticated
  USING ((SELECT public.can_access_tx(transaction_id)));
DROP POLICY IF EXISTS "write docs" ON public.documents;
CREATE POLICY "write docs" ON public.documents FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.can_access_tx(transaction_id)));

DROP POLICY IF EXISTS "read bids" ON public.bid_offers;
CREATE POLICY "read bids" ON public.bid_offers FOR SELECT TO authenticated
  USING ((SELECT public.can_access_tx(transaction_id)));
DROP POLICY IF EXISTS "update bids" ON public.bid_offers;
CREATE POLICY "update bids" ON public.bid_offers FOR UPDATE TO authenticated
  USING ((SELECT public.can_access_tx(transaction_id)))
  WITH CHECK ((SELECT public.can_access_tx(transaction_id)));
DROP POLICY IF EXISTS "write bids" ON public.bid_offers;
CREATE POLICY "write bids" ON public.bid_offers FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.can_access_tx(transaction_id)));

DROP POLICY IF EXISTS "read ai" ON public.ai_proposals;
CREATE POLICY "read ai" ON public.ai_proposals FOR SELECT TO authenticated
  USING ((SELECT public.can_access_tx(transaction_id)));
DROP POLICY IF EXISTS "update ai" ON public.ai_proposals;
CREATE POLICY "update ai" ON public.ai_proposals FOR UPDATE TO authenticated
  USING ((SELECT public.can_access_tx(transaction_id)))
  WITH CHECK ((SELECT public.can_access_tx(transaction_id)));
DROP POLICY IF EXISTS "write ai" ON public.ai_proposals;
CREATE POLICY "write ai" ON public.ai_proposals FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.can_access_tx(transaction_id)));

ANALYZE public.counterparties;
ANALYZE public.transaction_events;
ANALYZE public.documents;
ANALYZE public.transactions;
