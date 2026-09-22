-- Per-notification-type opt-in/opt-out, alongside the existing single "how" choice
-- (notification_channel). Stored as a jsonb map of type-key -> boolean; a missing key means
-- "subscribed" (the default), so existing accounts see every checkbox ticked until they
-- deliberately untick one.

alter table public.profiles
  add column if not exists notification_subscriptions jsonb not null default '{}'::jsonb;

comment on column public.profiles.notification_subscriptions is
  'Per-notification-type opt-out map, e.g. {"counterparty_emailed": false}. Absent key = subscribed. Keys match src/components/account/NotificationPreferences.tsx.';
