# The AI key isn't the problem — find the real reason a document wasn't read

## What I checked first

The advice in the message is not correct for this project:

- The AI credential **is** present in this app's server environment (it is injected at runtime, which is why it is not visible in the `.env` file — nothing should be pasted there).
- I called the AI service directly with that credential just now: it answered normally.
- One bid in the app (**BID9089016**) already has a document summary saved, generated at 00:22 today — so reading documents does work here.

So `AI is not configured` is not what stopped the latest upload. Two bids do have a file with no summary yet, most recently **BID9089384** (`RFP_Fleet_Vehicle_Supply_Leasing.pdf`).

The actual cause is still unconfirmed, so step 1 is to capture it rather than guess.

## Plan

1. **Capture the real failure.** Run the document reading step for BID9089384 (the bid that has a PDF and no summary) and read the server-side error and logs it produces. Likely candidates, in order: the PDF is too large for one request (that file is ~218 KB, so the base64 copy sent to the AI is bigger again), the reply came back in a shape the parser rejects, or the file could not be downloaded from storage.
2. **Fix what the error shows.** Expected shapes of the fix:
   - Oversized file: read the PDF's text on the server (or send fewer/smaller pages) instead of shipping the whole file, and cap what is sent per request.
   - Bad reply shape: accept the reply and retry once with a stricter instruction before failing.
   - Storage read failure: correct the download path/permission.
3. **Make failures visible instead of silent.** Save the reason a read failed against the bid and show it in the Bid Registered card next to the "Read documents" button, so a bid never sits with an empty summary and no explanation.
4. **Stop blaming the key wrongly.** Keep the "needs AI enabled" wording only for a genuinely missing credential; every other failure shows its own reason.
5. **Verify.** Re-run the read on BID9089384 and on the second stale bid, confirm a bulleted summary is saved and appears in the workspace, and confirm the search then has real details to work from.

## Technical notes

- No `LOVABLE_API_KEY` line is to be added to `.env` — the platform injects it, and a pasted copy would go stale on rotation.
- `src/lib/docSummary.functions.ts`: keep the current classification (image → signed URL, PDF → `file` part, docx/xlsx/text → extracted text); add a size guard and a text-extraction fallback for PDFs that exceed it, plus one strict retry on an unparseable reply.
- Persist the failure reason on `public.transactions` (new `document_summary_error text`) and clear it on a successful read.
- Surface it in `src/routes/_authenticated.live-deal-engine.tsx` where the "These documents haven't been read yet" notice already renders.
