-- AI+ orchestration layer: classify what a transaction actually is, and store the type-specific
-- facts extracted from its documents (grid capacity, PPA tenor, EPC timing, battery degradation,
-- land rights, environmental conditions for a project-finance deal, for example), so AI+ reasons
-- from the transaction's real structure instead of always applying generic bid/offer logic.

alter table public.transactions
  add column if not exists transaction_type text,
  add column if not exists structured_facts jsonb,
  add column if not exists structured_facts_generated_at timestamptz;

comment on column public.transactions.transaction_type is
  'AI+ orchestration: classified transaction type (commodity_trade, project_finance, other — see src/lib/transactionType.ts) used to pick the fact schema and the AI+ reasoning rule.';
comment on column public.transactions.structured_facts is
  'AI+ orchestration: type-specific facts extracted from the transaction''s documents. Field keys are defined per type in src/lib/transactionType.ts; only the classified type''s fields are ever filled.';
comment on column public.transactions.structured_facts_generated_at is
  'When structured_facts was last (re)extracted, so newer documents can be detected as making it stale the same way document_summary staleness is detected.';
