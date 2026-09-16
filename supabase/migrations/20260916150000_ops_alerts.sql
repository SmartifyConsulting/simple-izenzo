-- Throttle table for support@izenzo.co.za low-funds alerts (see src/lib/opsAlerts.server.ts) — one
-- row per third-party service, so a burst of failing requests sends one email per hour, not one
-- per request. Service-role only; nothing here is ever read by a signed-in user.
create table if not exists public.ops_alerts (
  service text primary key,
  last_sent_at timestamptz not null default now()
);

alter table public.ops_alerts enable row level security;

drop policy if exists "Service role only" on public.ops_alerts;
create policy "Service role only"
  on public.ops_alerts for all
  to service_role
  using (true)
  with check (true);
