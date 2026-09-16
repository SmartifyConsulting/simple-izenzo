-- The bug report composer moved into a modal that accepts multiple screenshots/files per report,
-- not just one image — replaces the single image_path column with an array, and the storage
-- bucket (previously image-only) now accepts any file type.
ALTER TABLE public.bug_reports ADD COLUMN IF NOT EXISTS attachment_paths TEXT[] NOT NULL DEFAULT '{}';

UPDATE storage.buckets
SET allowed_mime_types = NULL, file_size_limit = 20971520
WHERE id = 'bug-report-images';
