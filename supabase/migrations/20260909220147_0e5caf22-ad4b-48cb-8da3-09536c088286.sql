CREATE POLICY "Deal members can read deal documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = 'deals'
    AND public.can_access_tx(((storage.foldername(name))[2])::uuid)
  );

CREATE POLICY "Deal members can upload deal documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = 'deals'
    AND public.can_access_tx(((storage.foldername(name))[2])::uuid)
  );