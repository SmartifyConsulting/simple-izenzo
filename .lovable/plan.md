# Map tightening, clearer pulsing, reading progress and search-result space

## What changes

1. **Step 5 reads at 11px around the circle.** The label is set to 11px, and it is drawn on its own
   unstretched layer so it renders at a true 11px on screen — at the moment it is drawn on the
   stretched diagram layer, which squeezes it down to roughly 8px however it is sized.

2. **Online Screening fits on one line.** The tile is widened and shortened so "Online Screening"
   sits on a single line, and the Step 1 frame loses the height that the two-line tile needed.

3. **No repeated wording inside the Step 3 and Step 4 frames.** The words "Execution" and "Finality"
   are removed from inside their tiles, since both already appear as the frame headings. The detail
   lines (Concept, Pre-Reqs, Feasibility… and Payment, Signoff, Handover) stay, with their icons.

4. **Step 3, Step 4 and Entry / Exit are 40% shorter.** All three frames and their tiles lose 40% of
   their height, and the rest of the diagram moves up so nothing is left with a gap beneath it.

5. **Progress bars: pastel blue track, animated green bar.** Every progress bar on the Live Workspace
   and the one under Search on the map sits on a soft pastel blue track with a green bar moving across
   it. A failed run still shows red.

6. **The pulse is much more obvious.** The pulsing tile gets a stronger, wider halo, a heavier
   coloured border and a visible fade in and out, so the step you are on reads at a glance instead of
   being barely perceptible. The same treatment applies to the pulsing rows in the step list.

7. **Bid Information opens as soon as the documents go in.** Pressing Go after an upload opens the Bid
   Information frame straight away, so the detail being read is in front of you.

8. **A reading progress bar instead of "These documents haven't been read yet."** While the documents
   are being read, the frame shows a labelled progress bar ("Reading your documents…") on the same
   pastel blue and green treatment. The wording you saw appears when files are attached but no summary
   has been saved yet — either the read had not started or it failed silently. It is replaced by the
   progress bar, and a plain "Couldn't read these documents" line with a Try again button shows only
   when the read genuinely failed.

9. **"Fetch Interest" becomes "Find Counterparties."** The button, its running state ("Finding
   counterparties…") and the matching wording in the results panel all change with it.

10. **Bid Information collapses once counterparties are found.** It stays open while the search runs,
    then folds away the moment results arrive, giving the results list the room. The header stays
    clickable to open it again.

## How you will check it

- "Step 5 · Memory" reads at the same size as the other step labels; Online Screening is one line and
  the Step 1 frame is shorter; Step 3, Step 4 and Entry / Exit are noticeably flatter with no repeated
  headings inside them.
- Uploading and pressing Go opens Bid Information with a green-on-pale-blue reading bar, never the
  "haven't been read yet" line.
- The button reads Find Counterparties, and when results land Bid Information folds away.
- The current step unmistakably pulses.

## Technical notes

- `MapView.tsx` `ArrowLayer` uses `preserveAspectRatio="none"`, so the `text-[11px]` memory label
  scales with the canvas. Move the memory arc text into a second, non-stretched SVG overlay sized to
  the container (its own arc path in CSS-pixel space) so 11px is literal.
- `BOXES.socialMedia`: widen (roughly `w: 190`) and reduce `h` to a single-line height; trim
  `TRADE_ENGINE_FRAME.h` and pull `COMPLIANCE_FRAME`/the elbow waypoint up to match.
- Drop the `label` on the Execution and Finality `MapNode`s (keep `icon` + `sub`); allow an empty
  label so the sub-line is the tile's only text.
- Reduce `EXECUTION_FRAME`/`ENTRY_EXIT_FRAME`/`FINALITY_FRAME` and the `execution`/`entryExit`/
  `finality` box heights by 40%, then reduce `H` to the new content bottom.
- Progress bars in `MapView.tsx` and `DealCanvas.tsx`: track → a pastel blue token added to
  `src/styles.css` (e.g. `--progress-track`, `bg-progress-track`), bar `bg-success`, failure
  `bg-destructive`.
- `animate-throb-aqua` in `src/styles.css`: widen the halo (0 → ~14px), raise the starting alpha, add
  an opacity/border-colour swing and a heavier border.
- `_authenticated.live-deal-engine.tsx`: on document submit/Go call `setBidInfoCollapsed(txId, false)`;
  replace the `!documentSummary && workspaceDocs.length > 0` block with an indeterminate reading bar,
  keeping the retry button only when `readError` is set; rename the Fetch Interest button and its busy
  label (and the `MatchResultsPanel` copy); in `fetchInterest`/`runSearch` collapse Bid Information
  after matches are saved (`interestCount > 0`) rather than at kickoff.
