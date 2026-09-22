-- Per-rule notification channel preference (email, in-app, or both), set from Account Settings.
-- A person's own row only — no new table needed for something this small.
alter table public.profiles
  add column if not exists notification_preferences jsonb not null default '{}'::jsonb;

comment on column public.profiles.notification_preferences is
  'Per-notification-rule channel choice, e.g. {"new_bid": "both", "poi_sealed": "email", "wad_attention": "in_app"}. Missing keys default to "both" in the app.';
