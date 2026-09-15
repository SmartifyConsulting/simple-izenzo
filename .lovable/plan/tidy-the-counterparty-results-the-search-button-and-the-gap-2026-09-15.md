# Tidy the counterparty results, the Search button, and the gap under Bid Information

## What changes

1. **Bottom label and button removed.** The "Select who you want to trade with" caption and the wide grey button under the screening records disappear.

2. **The action moves onto the heading.** The "Online media screening results" heading row gets a small button on its right, in line with the collapse arrow. Until a party is picked it is greyed and reads "Select who you want to trade with"; once one is selected it turns blue and reads "Continue"; while it saves it reads "Recording your choice…". Clicking it does exactly what the old bottom button did.

3. **Heading renamed.** The folded list becomes "Online media search results (8)" instead of "Search results (8)".

4. **Search Results becomes its own accordion.** Once the choices are made and online media screening is running, the search results sit in their own collapsed frame directly under Bid Information, not nested inside the screening panel — so only one Search Results heading exists.

5. **The green Search button on the bid description bar goes back to the plain black round arrow button** it was before. The only green button is the frame-wide Search button at the bottom of the bid summary, in the same green as the pills with black text.

6. **The empty gap under Bid Information goes away.** Once documents have been submitted, the row that used to hold the upload box is no longer drawn at all, so the next frame sits directly under Bid Information at the same spacing as the other frames.

Nothing about who can be picked, the screening itself, or the steps that follow changes.

## Technical detail

`src/components/canvas/DealCanvas.tsx` (`CounterpartyRecord`):
- Line ~1421–1471: remove the nested "Search results (n)" accordion; the route-level frame is the single home for it. Keep `setProposalFor` usage where still needed.
- Media heading row (~1476–1488): the collapse `button` becomes a flex `div` holding the heading toggle plus, when `screeningDone && onFinalize`, a `size="sm"` Button (`disabled={finalizing || !pickedId}`, `onClick={() => pickedId && onFinalize(pickedId)}`) with the three labels above.
- Bottom block (~1745–1760): delete the `screeningDone && onFinalize` branch, keeping the `onContinue` shortlist button branch.
- Heading at ~1585: drop the `screeningDone ? "Select who you want to trade with"` case.
- Bid-description submit button (~2358–2368): restore the previous round icon-only button — `h-8 w-8 rounded-full bg-foreground text-background` with the arrow glyph only, no emerald fill and no "Submit" text.

`src/routes/_authenticated.live-deal-engine.tsx`:
- Line ~2103: gate the whole `{dealTx ? (...)}` upload row on `dealTx && !workspaceDocsPending && workspaceDocs.length === 0 && !submittedForThisBid`, so no empty `mt-1` row remains after submission.
- Search Results frame (~2252): keep it rendering as its own accordion while screening runs, and show the candidate list (with selected pinned to the top) inside it, so the removed nested list is not lost.
- Frame-wide Submit/Search button (~2096): green pill styling matching the workspace pills with black text.

Then typecheck and confirm the preview build is clean.
