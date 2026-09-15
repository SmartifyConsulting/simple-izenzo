# Tidy the counterparty results headings and close the gap under Bid Information

## What changes

1. **Bottom label and button removed.** The "Select who you want to trade with" caption and the wide grey button under the screening records disappear.

2. **The action moves onto the heading.** The "Online media screening results" heading row gets a small button on its right, in line with the collapse arrow. Until a party is picked it is greyed and reads "Select who you want to trade with"; once one is selected it turns blue and reads "Continue"; while it saves it reads "Recording your choice…". Clicking it does exactly what the old bottom button did.

3. **Heading renamed.** The folded list above it becomes "Online media search results (8)" instead of "Search results (8)".

4. **The empty gap under Bid Information goes away.** Once documents have been submitted, the row that used to hold the upload box is no longer drawn at all, so the next frame sits directly under Bid Information at the same spacing as the other frames.

Nothing about who can be picked, the screening itself, or the steps that follow changes.

## Technical detail

`src/components/canvas/DealCanvas.tsx` (`CounterpartyRecord`):
- Line ~1429: label text → `Online media search results ({candidates.length})`.
- Media heading row (~1476–1488): the collapse `button` becomes a flex row containing the heading button plus, when `screeningDone && onFinalize`, a `size="sm"` Button (`disabled={finalizing || !pickedId}`, `onClick={() => pickedId && onFinalize(pickedId)}`) with the three labels above; the outer element becomes a `div` so the action is not nested inside the toggle button.
- Bottom block (~1745–1760): delete the `screeningDone && onFinalize` branch, keeping the existing `onContinue` shortlist button as the remaining branch.
- Heading at ~1585: drop the `screeningDone ? "Select who you want to trade with"` case, leaving "Selected counterparties" / "Select a counterparty to continue".

`src/routes/_authenticated.live-deal-engine.tsx`:
- Line ~2103: gate the whole `{dealTx ? (...)}` upload row on the condition its child already uses — `dealTx && !workspaceDocsPending && workspaceDocs.length === 0 && !submittedForThisBid` — so no `mt-1` row remains after submission.

Then typecheck and confirm the preview build is clean.
