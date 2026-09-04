GRANT SELECT, INSERT, UPDATE ON public.organisations TO authenticated;
GRANT ALL ON public.organisations TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;

GRANT SELECT, INSERT ON public.transaction_events TO authenticated;
GRANT ALL ON public.transaction_events TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.bid_offers TO authenticated;
GRANT ALL ON public.bid_offers TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.counterparties TO authenticated;
GRANT ALL ON public.counterparties TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.ai_proposals TO authenticated;
GRANT ALL ON public.ai_proposals TO service_role;

GRANT SELECT, INSERT ON public.credit_ledger TO authenticated;
GRANT ALL ON public.credit_ledger TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.wad_cases TO authenticated;
GRANT ALL ON public.wad_cases TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.execution_records TO authenticated;
GRANT ALL ON public.execution_records TO service_role;

GRANT SELECT, INSERT ON public.stakeholder_events TO authenticated;
GRANT ALL ON public.stakeholder_events TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.finality_records TO authenticated;
GRANT ALL ON public.finality_records TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;