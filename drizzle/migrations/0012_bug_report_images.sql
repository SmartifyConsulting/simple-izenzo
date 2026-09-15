-- Lets a screenshot be dragged straight onto a bug/fix/nice-to-have record. Public bucket (no
-- signed URL needed to show the thumbnail) since these are internal dev screenshots, not
-- sensitive deal documents.
ALTER TABLE public.bug_reports ADD COLUMN IF NOT EXISTS image_path TEXT;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('bug-report-images', 'bug-report-images', true, 8388608, ARRAY['image/png','image/jpeg','image/webp','image/gif'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Bug report images are publicly readable" ON storage.objects;
CREATE POLICY "Bug report images are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'bug-report-images');

DROP POLICY IF EXISTS "Authenticated users can upload bug report images" ON storage.objects;
CREATE POLICY "Authenticated users can upload bug report images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'bug-report-images');

DROP POLICY IF EXISTS "Authenticated users can update bug report images" ON storage.objects;
CREATE POLICY "Authenticated users can update bug report images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'bug-report-images');
