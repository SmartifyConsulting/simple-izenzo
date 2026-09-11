-- Onboarding wizard: additive, nullable columns only. Safe for existing rows/users.

alter table public.profiles
  add column if not exists last_name text,
  add column if not exists contact_number text,
  add column if not exists terms_accepted_at timestamptz;

alter table public.organisations
  add column if not exists terms_of_trade text;
