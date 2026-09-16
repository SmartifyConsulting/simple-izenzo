# Stop the description / drop-files box reappearing in the Live Workspace

## Why it appears

That box is not a bug in itself: the workspace shows it whenever the bid it is
displaying has no files attached yet and has not been submitted. So it shows up on a
brand-new bid number — and it will also show up if the workspace happens to swing back
to a bid that never had a file saved against it. Either way it reads as if a finished
step has come back.

## What changes

1. The separate half-width box (description field + "Drop files here" + Next / Skip)
   is removed from the Live Workspace entirely. It never renders there again — not on a
   fresh bid, not after a refresh, not on a tab switch.

2. So a new bid can still be described and have files attached, that same
   description field and drop area move **inside the Bid Registration frame** at the top
   — one row under the bidder details, shown only while the bid has no files at all.
   It uses the existing wide green Submit button at the bottom of the summary rather than
   its own Next / Skip pair.

3. The moment the first file is attached, that row disappears from Bid Registration and
   the file list plus the AI summary take over, exactly as they do today. Further files
   are added from the Documents frame, as now.

4. "The AI summary appears here once a document is uploaded." stays as the Bid
   Information placeholder for an empty bid, since the way to fix it is now right above it.

Nothing about search, screening, intent or any later frame changes.

## Technical notes

- `src/routes/_authenticated.live-deal-engine.tsx`: delete the
  `dealTx && !workspaceDocsPending && workspaceDocs.length === 0 && !submittedForThisBid`
  block (~line 2213) that renders `DocumentUploadStep` in its own right-aligned column.
- Render `DocumentUploadStep` inside the Bid Registration frame (~line 1967 block) under
  the same emptiness condition, full width of the frame, with `hideActions` so its
  Next / Skip row is not drawn; keep `key={dealTx.id}`, `onNext`, `onSubmitted`,
  `onFirstClassified`, `initialPrompt`, `initialFiles` wiring unchanged.
- `src/components/guided/DocumentUploadStep.tsx`: add an optional `hideActions` prop
  that suppresses only the Next / Skip button row (~line 340-355). The existing
  `BidWizard` usage is untouched.
- No database, server function or workflow-gating change.
