-- Lightweight in-app electronic signature workflow for the project's UAT sign-off document.
-- Exactly three named individuals may sign; each may sign once. The database enforces both rules
-- itself, not just the UI: the check constraint is the list of authorised signers, the unique
-- constraint stops a second signature from the same person, and the deliberate absence of any
-- update/delete policy makes a row immutable the moment it exists — there is no API path that can
-- change or remove a signature once it's recorded.
create table if not exists public.uat_signoffs (
  id uuid primary key default gen_random_uuid(),
  signer_name text not null check (signer_name in ('David Davies', 'James Davies', 'Daniel Davies')),
  signed_at timestamptz not null default now(),
  pdf_path text not null,
  pdf_name text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (signer_name)
);

alter table public.uat_signoffs enable row level security;

drop policy if exists "Authenticated can read UAT signoffs" on public.uat_signoffs;
create policy "Authenticated can read UAT signoffs"
  on public.uat_signoffs for select
  to authenticated
  using (true);

drop policy if exists "Authenticated can record a UAT signoff" on public.uat_signoffs;
create policy "Authenticated can record a UAT signoff"
  on public.uat_signoffs for insert
  to authenticated
  with check (true);

-- Private bucket for the generated PDFs — readable by any signed-in person (this is a shared
-- project artefact, not a per-user document), never publicly listable.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('uat-signoffs', 'uat-signoffs', false, 5242880, array['application/pdf'])
on conflict (id) do nothing;

drop policy if exists "Authenticated can read UAT signoff PDFs" on storage.objects;
create policy "Authenticated can read UAT signoff PDFs"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'uat-signoffs');

drop policy if exists "Authenticated can upload UAT signoff PDFs" on storage.objects;
create policy "Authenticated can upload UAT signoff PDFs"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'uat-signoffs');
