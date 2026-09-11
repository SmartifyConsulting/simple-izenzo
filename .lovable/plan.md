# Read every uploaded document, not just images

## What changes for the user

- The upload panel asks for **one ID photo** and **any number of written documents** (PDF, Word, Excel, CSV, plain text). The second ID photo field is removed.
- The Submit button now reads all of them: the ID photo is read by eye (OCR), and PDF/Word/Excel/text files are read as text. Nothing is silently skipped any more.
- The summary comes back as **bullet points** instead of a paragraph.
- The **ID number is never shown** in the summary the other side sees. It is captured, encrypted and stored in the backend only.
- The summary is now actually saved against the bid/offer, so it survives a refresh (today it is generated and then lost, because there is nowhere in the database to keep it).

## Work to do

1. Database: add three fields to the deal record — the written summary, when it was generated, and the encrypted ID number.
2. Upload panel: drop the second ID photo field; single ID photo field, one file only; documents field accepts any written format. Adjust the checks so a file that has no readable writing is reported clearly instead of failing the whole read.
3. Document reading: send the ID photo as an image, PDFs as documents, and Word/Excel/CSV/text as extracted text, all in one request.
4. Summary format: bullet points, no ID number in the visible text.
5. ID number: returned separately by the AI, encrypted with the existing key before saving, never returned to the browser.

## Technical notes

- Migration on `public.transactions`: `document_summary text`, `document_summary_generated_at timestamptz`, `id_number_encrypted text`. No new grants/policies needed (existing table).
- `src/lib/docSummary.functions.ts`:
  - Classify each `documents` row by extension: image (`jpg/png/webp/heic/…`) → `image_url` block from a signed URL; `pdf` → `{ type: "file", file: { filename, file_data: "data:application/pdf;base64,…" } }` (download from storage and base64-encode server-side); `docx/xlsx/csv/txt/md` → extract text server-side and send as a `text` block; anything else → listed as not reviewed.
  - `docx`/`xlsx` extraction with `fflate` (unzip) plus XML text extraction — Worker-safe, no native deps. `csv/txt/md` read as UTF-8 directly.
  - Model stays `google/gemini-3.8-flash` on `/v1/chat/completions`; keep the existing 429/402 handling.
  - Ask for a strict JSON reply `{ "summary_bullets": string[], "id_number": string|null }`; join the bullets into the stored summary text, and pass `id_number` through `encryptSecret` in `integrationCrypto.server.ts` before writing `id_number_encrypted`. Only `{ summary }` is returned to the client.
- `src/routes/_authenticated.live-deal-engine.tsx`: remove `idBack` state, field and its branch in `submitDocuments`; `Attachment["kind"]` becomes `"ID" | "Document"`; the Didit ID check fires on the single ID photo; documents `<input>` gets a wide `accept` list.
