# Save deal attachments against the bid or offer

## What's wrong today

On the Live Deal Engine, when a user attaches ID and deal documents and clicks
submit, only the **file names** are recorded against the bid/offer. The actual
files are never uploaded anywhere, so nobody can open them later — the panel
just lists names. (The older Simple Mode upload step does store the real files,
so the app already has a working pattern to follow.)

## What will change

- Every attached file is uploaded and stored against that specific bid or offer
  ID, so it can be opened again from any device, by anyone with access to the
  deal.
- Each stored file keeps its name, its kind (ID front, ID back, Document), its
  version, its fingerprint, and who uploaded it — exactly as recorded now, plus
  the file itself.
- The attachment list on the deal shows each file as a link that opens or
  downloads it, instead of a plain name.
- Re-opening a deal (refresh, or coming back later) shows the same files, still
  openable.
- If an upload fails, the user is told which file failed and nothing half-saved
  is left behind; the deal does not advance until the files are safely stored.
- File size and type are checked before upload, with a clear message when a file
  is rejected.

## Not changing

Gates, token costs, permissions, the workflow order, and all existing database
rules stay exactly as they are. No schema changes are needed — the documents
table already has a place for the stored file location.

## Technical notes

- `submitDocuments` in `src/routes/_authenticated.live-deal-engine.tsx`
  currently inserts `documents` rows with `storage_path` left empty. It will
  upload each file to the existing private `documents` storage bucket under
  `<transaction_id>/<timestamp>-<filename>` first, then insert the row with that
  `storage_path`, mirroring `src/components/guided/DocumentUploadStep.tsx`.
- The restore-on-load effect and the attachments list will also select
  `storage_path`, and render each entry as a signed-URL link
  (`supabase.storage.from("documents").createSignedUrl(path, 60)`).
- Upload errors abort the submit before `advance(...)` runs, so a failed upload
  never moves the deal to the search step.
- Bucket RLS on `storage.objects` is already scoped by transaction access; no
  policy change is required.
