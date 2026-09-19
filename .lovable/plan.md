# Make bug report attachments actually save and open

## What's wrong

Screenshots and files attached to a bug report were never stored, so there is nothing to open.

Confirmed by checking the database and file storage:

- The bug report records have no place to store attachment file names — those two fields do not exist on the table.
- The storage folder the screen uploads into (`bug-report-images`) does not exist at all, and holds zero files.
- The screen ignores upload failures silently, so a report looked like it sent successfully while the screenshot was discarded.

So every past submission has lost its attachment. Nothing can recover those — they were never uploaded.

## What gets built

1. **Somewhere to keep the files** — create the private `bug-report-images` storage folder, readable only by the person who filed the report and by administrators.
2. **Somewhere to record them** — a migration adding `image_path` (text) and `attachment_paths` (text array) to `bug_reports`, which the screen already expects.
3. **Uploads stop failing quietly** — if a file cannot be uploaded, the report still saves but you get a clear message naming the file, instead of silence.
4. **Viewing works** — thumbnails and file chips open using short-lived signed links (the folder is private), with a full-size preview for images and open/download for everything else.
5. **Open a full record** — clicking a report in the list opens it in a window showing who filed it, when, the full text, and every attachment, so long reports are no longer truncated to one line.

## Note for you

Attachments filed before this fix are gone and cannot be restored. Once this is in, ask the people who reported issues to re-attach their screenshots (dropping a file straight onto an existing record already works and will now stick).

## Technical detail

- `supabase--storage_create_bucket` for `bug-report-images` (private, 10MB cap), then a migration with `storage.objects` policies: insert/select for `auth.uid()` matching the report owner via the `<report-id>/` path prefix, plus full select for `public.has_role(auth.uid(), 'admin')`.
- Migration also: `alter table public.bug_reports add column if not exists image_path text, add column if not exists attachment_paths text[]`. No change to existing RLS on `bug_reports` (own-reports-or-admin select stays as hardened).
- Regenerate Supabase types afterwards so the `as unknown as never` casts in `BugReportMenu.tsx` can go.
- `bucketUrl()` in `src/components/BugReportMenu.tsx` is replaced by `createSignedUrl(path, 3600)` resolved through a small `useQuery` keyed on the path; upload loop surfaces `upErr` per file and the `attachment_paths` update checks its error.
- New detail dialog in the same component, reusing the existing preview dialog for full-size images.
- No change to trade workflow, governance, POI/WaD/Execution/Finality, or AI+.
