-- Reporters could upload files for their own bug report but never save the paths onto it: the
-- only UPDATE policy on bug_reports is admin-only, so attachment_paths silently stayed empty
-- and admins had nothing to open. Let the reporter update their own report.
DROP POLICY IF EXISTS "Users can update their own bug reports" ON public.bug_reports;
CREATE POLICY "Users can update their own bug reports"
ON public.bug_reports FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Signed links need the caller to be able to read the object, whether or not the bucket is public.
DROP POLICY IF EXISTS "Authenticated users can read bug report attachments" ON storage.objects;
CREATE POLICY "Authenticated users can read bug report attachments"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'bug-report-images');
