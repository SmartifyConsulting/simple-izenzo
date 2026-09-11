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

## Visual tweaks (same pass)

- The Attachments badge gets a soft fill in the same orange as its border, instead of sitting on a plain background.
- The "Running AI and AI+ search" frame gets that same orange fill and edge, so search and attachments read as one family.
- All the white outlines around the black frames get thinner and softer.

Technical: use the existing `--warning` token via `bg-warning/12` + `border-warning/40` for the Attachments badge and the AI/AI+ searching frame in `src/routes/_authenticated.live-deal-engine.tsx`; reduce `--glass-border` opacity and keep the `glass`/`glass-node` border at a hairline (`1px` at lower alpha) in `src/styles.css` so every dark frame's white edge is thinner.

## Bid/Offer picker at the top

- The horizontal scrolling strip of open bid numbers is replaced by a dropdown.
- Each entry shows the bid/offer number together with the trade name.
- It opens on the most recent trade by default; with no active trades it shows nothing selected.

Technical: replace `OpenDealsStrip` usage with a shadcn `Select` listing open deals (`reference` + `title`), value bound to the current `dealTx.id`, defaulting to the newest by `created_at`, empty placeholder when the list is empty; selecting one loads that deal exactly as the strip does today.
