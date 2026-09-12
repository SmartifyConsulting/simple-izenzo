# Live Workspace fits the screen, and the missing document summary

## Layout changes

1. Frame around the pair
   - One outer frame wraps both the Izenzo Trade Workflow and the Live Workspace, so they read as a single working surface instead of two loose boxes. The Live Workspace keeps its own inner frame; the workflow side loses its floating look and sits inside the shared frame.

2. Shorter and wider
   - The Live Workspace frame becomes 10% shorter so the whole pair fits inside the screen without the page scrolling, and 25% wider.
   - The workflow diagram keeps scaling to fit; the Live Workspace still scrolls its own content when it runs long.

6. The Search Prompt disappears once a document is attached
   - As soon as a document is uploaded, the description box and drop strip give way to the attached files list and one button, "Find Matching Interest", which starts the search.
   - With nothing attached yet, the prompt and drop strip look exactly as they do today.


3. Bid/Offer ID inline with the heading
   - "Live Workspace" and the bid reference sit on the same line — heading on the left, reference on the right — and the reference badge becomes longer (roughly double its current width) so a full reference never crowds. It stays bold monospace.
   - The separate reference line below the heading goes.

4. Centred menu
   - The top menu items are centred in the header instead of pushed to the right; the logo stays left and the inbox/tokens/theme/avatar controls stay right.

5. Heading rename
   - "Live deal engine" is replaced with "Submit your Proposal" wherever it appears above a deal.

## The document that produced nothing on BID9088893

What I can confirm from the records:

- BID9088893 (the bid open on your screen) has no documents attached at all, and no prompt saved.
- The PDF you uploaded ("Implemention of a Laboratory Information System…") is attached to a different bid, BID9089439, created a few minutes earlier. So the bid you are looking at was never given anything to read.
- No bid in the workspace has a saved summary yet, so the read did not succeed on BID9089439 either. I have verified the AI service itself answers normally and reads PDFs of this type, so the key/service is not the problem. The reason that one read failed is not yet established.

So the work here is:

1. Re-run the read on BID9089439 and capture the exact failure, then fix that cause.
2. Make the failure visible instead of a toast that disappears: when a bid has documents but no summary, the workspace shows a short line saying the documents haven't been read yet, with a "Read documents" button.
3. Make it obvious which bid an upload belongs to: the upload panel names the bid reference it is attaching to, so a document can't be added to the wrong tab unnoticed.

## Unchanged

- Gates, tokens, certificates and all business rules.
- What the search does and the scoring behind the percentages.
- The tab row, including the fixed "New" tab.

## Technical notes

- `src/routes/_authenticated.live-deal-engine.tsx`: wrap the two-column grid in one `rounded-3xl border border-border bg-card/40 p-3` container; drop the workflow column's implicit standalone framing and the Live Workspace column's own outer rounding duplication; heights `h-[calc(100vh-190px)]` → a shorter shared value (`h-[calc(100vh-250px)]`) with `min-h-0` intact. Route renders through `AppShell` with `wide` so the shell uses `max-w-[1680px]` instead of `max-w-7xl` (~20% wider).
- Heading row: replace the standalone `<p className="label-caps mb-3">Live Workspace</p>` and the separate `draftReference` paragraph with a single `flex items-center justify-between gap-3 mb-3` row; move `OpenDealsPicker` into it and widen its trigger from `w-[140px]` to `w-[280px]`, keeping `font-mono text-base font-bold`.
- `src/components/layout/MainHeader.tsx`: nav becomes `absolute left-1/2 -translate-x-1/2` (or `flex-1 justify-center` with the logo/controls as fixed-width flanks) instead of `ml-auto`; the mobile dropdown trigger keeps `ml-auto`.
- `src/components/canvas/DealCanvas.tsx` lines ~368, ~2026, ~2036: `Live deal engine` → `Submit your Proposal`. Route `head()` titles stay as they are.
- Document read: invoke `summarizeBidDocuments` for `5e8ad63c-0568-4efb-82b5-e5d1f99d68ed` and read the thrown message (storage download under the `Deal members can read deal documents` policy, the `type: "file"` PDF part, and the JSON reply shape are the three candidates), then fix that path. Verified already: `LOVABLE_API_KEY` is present in the running server process, the gateway returns 200 for `google/gemini-3.8-flash`, and a `type: "file"` PDF part is read correctly.
- Workspace fallback: where `documentSummary` is null but `workspaceDocs.length > 0`, render the "not read yet" line plus a button calling `summarizeBidDocuments` and invalidating `["transaction", id]`.
- `src/components/guided/DocumentUploadStep.tsx`: show the target bid reference in the panel label (passed in from the page's `dealTx.reference`).
