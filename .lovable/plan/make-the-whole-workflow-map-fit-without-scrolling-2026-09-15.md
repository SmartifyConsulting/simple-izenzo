# Make the whole workflow map fit without scrolling

The map matches the attached arrangement, but it runs off the bottom of its panel — Step 3, Entry / Exit and Step 4 sit below the fold. The fix is to tighten the vertical gaps and shorten the tall empty stretches so the entire diagram sits inside the panel at a normal window height, with no downward scrolling.

## What changes

1. **Step 1 (Trading) tightened.** Slightly smaller gaps between the Bid / Upload Files column, the Search row, Online Screening and Express Intent, and less empty space at the bottom of the Step 1 frame.

2. **Gap between Step 1 and Step 2 reduced.** The long blank band between the two frames shrinks to a clean, even gap that still leaves room for the connecting arrow.

3. **Step 2 (GRC) tightened.** The four checks keep their order and their arrows between each pair, with shorter gaps so the frame is less tall.

4. **Step 3, Entry / Exit and Step 4 move up.** They follow the shorter Step 2, so the bottom row lands inside the visible area instead of below it.

5. **Memory circle re-centred and slightly smaller** so it stays level with Step 2 and Step 4 in the new, shorter layout, and its incoming arrow still runs cleanly up from Step 4.

6. **Horizontal arrangement untouched.** Every tile stays exactly where it is left-to-right — same columns, same order, same frame labels, same sizes of the tiles themselves. Only vertical spacing changes.

Nothing about the workflow, pulsing, gates, tokens or clicking behaviour changes.

## How you will check it

At a normal window height, the whole diagram is visible top to bottom in the workflow column — Step 1, Step 2, the Memory circle, Step 3, Entry / Exit and Step 4 — with no vertical scrollbar, and every connector still lands on a tile edge.

## Technical notes

- `src/components/canvas/MapView.tsx` only, presentation geometry:
  - reduce the canvas height `H` (875) to roughly 700 and re-derive the y positions below.
  - Step 1: `bid`/`loadDocs`/`search`/`steps`/`offer`/`choice`/`counterOffer` shift up a few px; `socialMedia` and `expressIntent` y reduced; `TRADE_ENGINE_FRAME.h` trimmed to its content.
  - inter-frame band: `COMPLIANCE_FRAME.y` lowered from 422 to roughly 320, so the elbow waypoint (computed from the frame edges) stays centred automatically.
  - Step 2: `poi`/`wad`/`withoutADoubt`/`businessDocs` y gaps cut from ~68–74 to ~58, `COMPLIANCE_FRAME.h` reduced to match.
  - bottom row: `execution`/`entryExit`/`finality` and `EXECUTION_FRAME`/`ENTRY_EXIT_FRAME`/`FINALITY_FRAME` y moved up in step with Step 2's new bottom edge.
  - `MEMORY` `cy` re-centred between the new Step 2 and Step 4 rows, `r` trimmed if it would overlap either frame.
- `ARROWS` needs no structural change — all endpoints derive from the box table; verify no connector crosses a frame after the shift.
- No spine, gating, database or server-function changes.
