-- Real usage/cost tracking for every external AI/integration call this app makes — OpenAI chat
-- and web search, Tavily search, Didit verification sessions, Resend email sends. Until now
-- nothing recorded what these actually cost on the admin's own provider accounts; credit_ledger
-- only tracks the platform's own internal token economy (what's charged to customers), which is a
-- different number entirely. One row per call, so spend can be traced back to the specific
-- transaction (and specific minute) that caused it.

create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid references public.transactions(id) on delete set null,
  org_id uuid,
  provider text not null,              -- 'openai' | 'tavily' | 'didit' | 'resend' | 'firecrawl'
  operation text not null,             -- short label: 'counterparty_search', 'media_scan', 'kyc_check', ...
  model text,
  input_tokens integer,
  output_tokens integer,
  total_tokens integer,
  cost_usd numeric(10, 5),
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_events_transaction_id_idx on public.ai_usage_events (transaction_id);
create index if not exists ai_usage_events_created_at_idx on public.ai_usage_events (created_at desc);
create index if not exists ai_usage_events_provider_idx on public.ai_usage_events (provider);

alter table public.ai_usage_events enable row level security;

drop policy if exists "Service role only" on public.ai_usage_events;
create policy "Service role only"
  on public.ai_usage_events for all
  to service_role
  using (true)
  with check (true);
