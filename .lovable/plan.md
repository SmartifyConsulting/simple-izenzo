# Map tightening, clearer pulsing and green progress bars

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
   being barely perceptible. The same treatment applies to the pulsing rows in the step list, so map
   and list stay consistent.

## How you will check it

- "Step 5 · Memory" reads at the same size as the other step labels.
- Online Screening is one line and the Step 1 frame is visibly shorter.
- The Step 3 and Step 4 frames show only their detail lines, at 40% less height, as does Entry / Exit.
- A running search shows a green bar on a pale blue track.
- The current step is unmistakably pulsing.

## Technical notes

- `MapView.tsx` `ArrowLayer` uses `preserveAspectRatio="none"`, so the `text-[11px]` memory label
  scales with the canvas. Move the memory arc text into a second, non-stretched SVG overlay sized to
  the container (its own arc path in CSS-pixel space, positioned on the circle) so 11px is literal.
- `BOXES.socialMedia`: widen (roughly `w: 190`) and reduce `h` to a single-line height; trim
  `TRADE_ENGINE_FRAME.h` and pull `COMPLIANCE_FRAME`/the elbow waypoint up to match.
- Drop the `label` text on the Execution and Finality `MapNode`s (keep `icon` + `sub`); allow an empty
  label so the sub-line becomes the tile's only text.
- Reduce `EXECUTION_FRAME`/`ENTRY_EXIT_FRAME`/`FINALITY_FRAME` heights and the `execution`/
  `entryExit`/`finality` box heights by 40%, then reduce `H` so the canvas ends at the new content
  bottom.
- Progress bars in `MapView.tsx` and `DealCanvas.tsx`: track `bg-muted` → a pastel blue token added to
  `src/styles.css` (e.g. `--progress-track`, used as `bg-progress-track`), bar stays `bg-success`,
  failure stays `bg-destructive`.
- `animate-throb-aqua` in `src/styles.css`: widen the halo (0 → ~14px), raise the starting alpha, and
  add an opacity/border-colour swing plus a heavier border so the pulse is clearly visible in both
  themes.
