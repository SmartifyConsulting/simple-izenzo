-- Registration no longer runs a photo-ID/KYC scan at signup — KYC, KYB, AML and PEP now only run
-- during the WaD compliance gate on a live deal. In its place, registration captures a manually
-- typed ID/passport number and a mandatory "Authority to Act" document upload.
alter table public.profiles
  add column if not exists id_number_type text check (id_number_type in ('id', 'passport')),
  add column if not exists id_number text,
  add column if not exists authority_to_act_path text,
  add column if not exists authority_to_act_name text,
  add column if not exists authority_to_act_uploaded_at timestamptz;

-- Private bucket (no public read) — this is a legal document, not a picture. Each person can only
-- reach their own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'authority-to-act',
  'authority-to-act',
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

drop policy if exists "Users can read their own authority to act document" on storage.objects;
create policy "Users can read their own authority to act document"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'authority-to-act'
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "Users can upload their own authority to act document" on storage.objects;
create policy "Users can upload their own authority to act document"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'authority-to-act'
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "Users can replace their own authority to act document" on storage.objects;
create policy "Users can replace their own authority to act document"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'authority-to-act'
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = auth.uid()::text
  );
