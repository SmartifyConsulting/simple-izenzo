-- Four related registration/workflow additions. Additive and nullable only; every existing row is
-- backfilled to a value that leaves it exactly as it behaved before.
--
-- 1. An account is registered either as a company or as an individual, and that choice now has to
--    be remembered (it was previously only local React state in the sign-up form, thrown away on
--    submit). It decides which document registration asks for.
-- 2. Individuals do not need an Authority to Act document — they only prove their residential
--    address (under three months old).
-- 3. A new account is walked through the registration wizard before it can use the app; accounts
--    that already exist are explicitly left alone so this cannot lock anyone out mid-test.
-- 4. Legal Agreements only pulses once the bidder has actually clicked Continue on Without a
--    Doubt, which needs to be recorded rather than being a throwaway UI action.

alter table public.profiles
  add column if not exists account_type text;

alter table public.profiles
  drop constraint if exists profiles_account_type_check;
alter table public.profiles
  add constraint profiles_account_type_check
  check (account_type in ('company', 'individual'));

comment on column public.profiles.account_type is
  'Whether this account trades as a company or as a natural person. Decides which document registration requires: Authority to Act for a company, proof of residential address for an individual.';

-- Proof of residential address — an individual's registration document. Same private-bucket and
-- one-folder-per-person shape as authority-to-act, so a resident's bill is never publicly readable.
alter table public.profiles
  add column if not exists residential_address_path text,
  add column if not exists residential_address_name text,
  add column if not exists residential_address_uploaded_at timestamptz;

-- Registration is a real step for a new account, not a dismissible prompt. Existing accounts are
-- set to false below so nothing already in flight is interrupted; the default only ever applies to
-- rows inserted from now on (the auth.users trigger's insert included).
alter table public.profiles
  add column if not exists onboarding_required boolean not null default true;

update public.profiles set onboarding_required = false;

comment on column public.profiles.onboarding_required is
  'True for accounts created from this migration onward until they finish the registration wizard. False for every pre-existing account, so the wizard cannot trap anyone who signed up before it existed.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'proof-of-residence',
  'proof-of-residence',
  false,
  10485760,
  array[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do nothing;

drop policy if exists "Users can read their own proof of residence" on storage.objects;
create policy "Users can read their own proof of residence"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'proof-of-residence'
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "Users can upload their own proof of residence" on storage.objects;
create policy "Users can upload their own proof of residence"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'proof-of-residence'
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "Users can replace their own proof of residence" on storage.objects;
create policy "Users can replace their own proof of residence"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'proof-of-residence'
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- Recorded the moment the bidder clicks Continue on Without a Doubt. Legal Agreements only starts
-- pulsing on the strength of this, so the map stops pointing at a step nobody has been sent to yet.
alter table public.transactions
  add column if not exists wad_continued_at timestamptz;

comment on column public.transactions.wad_continued_at is
  'Set when the bidder continues past the cleared Without a Doubt gate. Gates the Legal Agreements pulse and the automatic move into Step 3.';

-- The AI's reading of the legal agreements — what each party is expected to do, the terms and the
-- dates. Filed on the deal itself so both sides read the same interpretation.
alter table public.transactions
  add column if not exists concept_brief text,
  add column if not exists concept_brief_generated_at timestamptz,
  add column if not exists concept_brief_error text;

comment on column public.transactions.concept_brief is
  'AI interpretation of the legal agreements and deal terms, shown in Execution > Concept. Advisory only; nothing reads it as a decision.';
