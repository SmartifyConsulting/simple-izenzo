# Live Workspace tidy-up and a truthful pulsing workflow

## What changes

1. One heading only in a new workspace
   - The blank workspace currently shows "Live Workspace" twice, one under the other. The second one goes; the panel keeps a single heading, and once a bid exists that spot shows the bid/offer reference as it does today.

2. Bid/Offer ID at the top right
   - The reference text gets noticeably larger and stays bold monospace so it reads as the identifier of the deal.
   - The pill holding it is halved in width, so it is a compact badge rather than a wide bar.

3. A Submit button for the workspace search
   - Below the attached files list, a full-width "Submit" button starts the search on demand, instead of relying only on the automatic run.
   - It stays disabled while files are uploading or being read, and while nothing has been typed and nothing attached.

4. The step you are on always pulses
   - The workflow list on the left highlights and pulses the item that is genuinely current at that moment, at every point of the flow — not only during the media screening.
   - Completed items stay green and ticked; later items stay quiet.

5. Search AI + AI+ and Online Media Screening run together
   - Both start at the same time when a submission goes in, and both show as in progress at once rather than one waiting for the other.
   - When the result list appears, both are ticked and Choice becomes the pulsing item, so the next thing to do is obvious.

6. Fix "Uploaded, but the documents could not be read: AI is not configured for this workspace"
   - Cause found: the AI key does exist for this project, but the running app process was started without it, so every read of an uploaded document fails with that message. Nothing is wrong with your upload or your documents.
   - The app process is restarted so it picks the key up, and the document reading is then run again on the bid you are on, so its summary appears.
   - The message itself becomes honest: if the key ever really is missing, it says the workspace owner needs to enable AI, and offers "Try again" instead of leaving the upload looking broken.

7. Reading the uploaded files with OCR and AI
   - Photos and scanned pages are read by sight (OCR); PDF, Word, Excel, CSV and plain text are read as text.
   - Everything read is summarised into the bullet list of the trade's material aspects at the top of the workspace, and any ID number stays backend-only.
   - Files that genuinely cannot be read are named individually, so one bad file no longer blocks the rest.

8. Completed steps read as ticked labels
   - In the workflow list, a step that is finished shows its tick and label only — the task rows inside it are replaced by that single ticked line rather than repeating the tasks.
   - Ticked items sit on the left with their label, not pushed to the right-hand edge.

9. "Bid creation" is renamed "Bid Registration" everywhere it appears.

10. Breathing room and the value in the summary
   - Space is added under the "Live Workspace" heading so the content below it no longer sits tight against it.
   - The bid/offer amount or value moves into the Summary frame, listed with the other material aspects of the trade instead of sitting apart from them.

## Unchanged

- Gates, tokens, certificates and all business rules.
- What the search actually does and the scoring behind the percentages.
- The tab row, including the fixed "New" tab.

## Technical notes

- `src/routes/_authenticated.live-deal-engine.tsx`: drop the `draftReference ?? "Live workspace"` fallback heading (around line 1128); rename the "Bid Creation" checklist line (line ~1183) to "Bid Registration" and update any other occurrence found by search.
- `OpenDealsPicker` trigger: `w-[280px]` → `w-[140px]`, reference text to `text-base font-bold`.
- `src/components/guided/DocumentUploadStep.tsx`: render the action button in `autoAdvance` mode too, labelled "Submit", calling the same `next()`; disabled while `uploading || reading` or with no docs and an empty prompt. Its catch branch (line ~151) surfaces per-file failures and a clearer "AI not enabled" message with a retry that re-calls `summarizeBidDocuments`.
- Root cause of the error, verified: `LOVABLE_API_KEY` is present in the project secrets and the sandbox shell, but absent from the running dev-server process environment (`/proc/<vite pid>/environ` has no such entry), so `docSummary.functions.ts:31` reads `undefined` and throws at line 32. Fix = restart the dev server so the injected env is picked up, then re-run `summarizeBidDocuments` for the current transaction. No code change is needed for the key itself.
- OCR/AI reading already exists in `src/lib/docSummary.functions.ts` (image parts by signed URL, PDF/Word/Excel/CSV as text); keep it, and make the per-file `unreadable[]` list surface in the UI instead of a single blanket toast.
- Concurrency: kick `runSearch` and the media checks off together with `Promise.allSettled` from one submit handler, tracking `searchRunning` and `mediaRunning` independently.
- Pulsing + ticked collapse in `src/components/canvas/ClassicView.tsx`: a derived override map from the page's flow state for every phase — `documents` → `bidOffer` active; submitted → `bidOffer` done and `search` + `onlineMedia` active; results present → both done and `choice` active; after a choice → `choice` done and `poi` active. A step whose items are all `done` renders as one left-aligned ticked label row (tick + step label, `justify-start`) instead of its item list.
- Spacing: the workspace panel's `label-caps` "Live Workspace" heading gains bottom margin (`mb-3`) so the summary block below it is not flush against it.
- Value in the summary: the summary block renders a value line from the transaction's `price`/`currency`/`quantity`/`unit` (formatted with the existing currency helper) as the first bullet, and it is removed from wherever it currently sits outside the frame.
