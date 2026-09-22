-- One global notification-channel choice per person (Email, In-app, or Both), set from Account
-- Settings — not a separate choice per notification type.
alter table public.profiles
  add column if not exists notification_channel text not null default 'both';

alter table public.profiles
  drop constraint if exists profiles_notification_channel_check;
alter table public.profiles
  add constraint profiles_notification_channel_check
  check (notification_channel in ('email', 'in_app', 'both'));

comment on column public.profiles.notification_channel is
  'How this person wants to be notified — email, in_app, or both. Applies to every notification the platform raises for them.';
