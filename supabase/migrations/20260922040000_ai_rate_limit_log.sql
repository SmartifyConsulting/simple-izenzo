-- Visibility into plain OpenAI rate limits (429, not an exhausted-quota alert — see
-- src/lib/opsAlerts.server.ts's alertLowFunds, which only fires for the quota case). Until now,
-- "AI is busy right now. Please try again shortly." left no trace anywhere it happened, so there
-- was no way to tell how often it was actually occurring. One row per (service, model), counted.

create table if not exists public.ai_rate_limit_log (
  service text not null,
  model text not null,
  hit_count integer not null default 1,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (service, model)
);

alter table public.ai_rate_limit_log enable row level security;

drop policy if exists "Service role only" on public.ai_rate_limit_log;
create policy "Service role only"
  on public.ai_rate_limit_log for all
  to service_role
  using (true)
  with check (true);
