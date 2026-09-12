-- Profile/organisation picture uploads (AvatarUpload component) target a bucket named "avatars"
-- that was never created via migration — every upload fails with "Bucket not found". Creates the
-- bucket (public read, since avatars are shown across the app with no signed URL) and the RLS
-- policies letting a signed-in user manage files under their own users/<uid>/... or an org they
-- belong to under orgs/<org_id>/....
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

create policy "Avatar images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Users can upload their own avatar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "Users can update their own avatar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "Users can delete their own avatar"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- Organisation logos: any member of the org can manage its picture.
create policy "Org members can upload their org's avatar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = 'orgs'
    and exists (
      select 1 from public.org_members m
      where m.org_id::text = (storage.foldername(name))[2]
        and m.user_id = auth.uid()
    )
  );

create policy "Org members can update their org's avatar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = 'orgs'
    and exists (
      select 1 from public.org_members m
      where m.org_id::text = (storage.foldername(name))[2]
        and m.user_id = auth.uid()
    )
  );
