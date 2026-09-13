# Two fixes: document preview still blocked, and the upload frame reappearing

## 1. Preview and download are blocked by the browser

Your browser extension/ad blocker blocks the storage address itself, so both the current preview
(which fetches that address before opening it) and the download link still hit the blocked host and
you get the "blocked by Chrome" page.

The file will instead be fetched **through the app's own address**, so nothing from the storage host
is ever requested by your browser:

- Preview opens the file from inside the app (an in-app blob), fetched via the app's own server.
- Download uses the same route, so it can't be blocked either.
- If the file genuinely can't be read (missing or too large), a clear message says so.

## 2. The upload frame must not come back

In the second screenshot the drop frame is showing with a spinner — a file is being read/uploaded,
but the frame stays visible and the summary line still says "once a document is uploaded".

Changes:

- The moment files are dropped or **Submit** is pressed, the frame is replaced by a short
  "Reading your documents…" state — never the drop frame again.
- Once anything has been submitted for a bid, the frame stays gone across refreshes and tab
  switches; the bid shows its documents, summary and **Fetch Interest** instead.
- While documents are still saving, the BID INFORMATION line reads "Reading your documents…"
  rather than claiming nothing was uploaded.
- If a document fails to save, an error with a retry appears in place of the frame — not the frame
  itself.

## Technical detail

- New server function `readDocument` (in `src/lib/docSummary.functions.ts` or a new
  `src/lib/documents.functions.ts`), guarded by `requireSupabaseAuth`: verifies the caller can see
  the document row, downloads the object server-side from the private `documents` bucket, and
  returns `{ name, contentType, base64 }` (reject over ~15 MB with a clear error).
- `openAttachment` / `downloadAttachment` in `_authenticated.live-deal-engine.tsx` stop calling
  `createSignedUrl`; they call `readDocument`, build a `Blob` from the base64, then `window.open` a
  `blob:` URL (preview) or click an `<a download>` (download), revoking the URL after a delay.
- Upload frame gating: add a per-bid `submittedRef`/state (set by `DocumentUploadStep`'s submit and
  by drop) plus the existing `workspaceDocsPending`; render `DocumentUploadStep` only when
  `!workspaceDocsPending && workspaceDocs.length === 0 && !submittedForThisBid`. Persist the
  submitted flag in `sessionStorage` keyed by transaction id so a refresh mid-upload doesn't bring
  the frame back.
- The BID INFORMATION placeholder text at line ~1446 gains the "Reading your documents…" branch for
  the pending/submitted case.
- No changes to search logic, scoring, gates or token costs.

## 3. Choosing a counterparty: radio buttons and the % match

- The candidate list in the Record panel currently uses square tick boxes and shows `72/100`.
  At the point where one party must be chosen it becomes a proper single-select **radio** list
  (choosing one clears the other), so it's obvious only one can be picked.
- Each row shows the match as a **black pill with white text reading `72% match`**, the same as the
  search results list — no more `/100`.
- Rows with no score show nothing rather than an empty pill.

## 4. BID INFORMATION must collapse when Fetch Interest is clicked

It collapses today only when the button itself is pressed; starting the search any other way
(Submit straight after upload, or a reopened bid) leaves it expanded. The collapse moves into the
search start itself, so BID INFORMATION is always a closed clickable header once interest is being
fetched, and stays closed for that bid until the user reopens it.

## Technical detail (additions)

- `DealCanvas.tsx` candidate list (~line 1222): replace `Checkbox` with `RadioGroup`/`RadioGroupItem`
  from `@/components/ui/radio-group` while `screeningDone` (the single-choice phase); keep multi-select
  shortlisting checkboxes for the earlier shortlist phase. Score badge (~line 1235 and the
  ~line 1379 duplicate) becomes `rounded-full border border-foreground bg-foreground text-background`
  with `{c.score}% match`.
- `setBidInfoOpen(false)` moves from `fetchInterest` into `runSearch` in
  `_authenticated.live-deal-engine.tsx`, so every path that starts a search collapses the frame;
  the collapsed state is remembered per bid id.
