# Workflow map polish and a working New tab

## What changes

1. **The New tab works every time, with a new bid number.** Pressing New while you are already on a
   new, empty workspace currently does nothing, because the address it navigates to is the one you
   are already on. Each press now genuinely starts a clean workspace — cleared prompt, cleared files,
   no bid attached — and always issues a fresh, unused BID number for it, never the one shown on the
   previous new workspace.

2. **Step 5 label at 11px.** The "Step 5 · Memory" text around the memory circle is set to the same
   11px as the other step labels.

3. **Entry / Exit matches the Search tile height.** Its tile is set to the same height as the Search
   tile so the two read as the same size.

4. **The whole map fits without scrolling.** Vertical spacing is tightened — shorter gaps between
   the Trading, Compliance, Execution and Finality groups and slightly shorter tiles — so the
   diagram sits inside its column at a normal window height with no scrolling.

5. **Search progress bars are green.** The progress bars beneath Search and screening turn green
   instead of blue/orange (failures stay red).

6. **Bid Information visible after Search.** Once Search has been pressed, the Bid Information
   section is shown open rather than collapsed, so the bid's details stay in view alongside the
   results. It can still be closed by hand.

7. **The bid number appears in the Bid tile, and Load Files pulses.** A new workspace already has a
   bid number, so Bid is no longer the pulsing step — Load Deal Documents pulses instead, as the
   next thing to do. The Bid tile itself shows the bid number (BID…) in black inside the tile.

## How you will check it

- Pressing New twice in a row gives an empty workspace both times.
- The map fits on screen top to bottom, Entry / Exit matches Search in height, Step 5 reads at the
  same size as the other step labels.
- On a new workspace the Bid tile shows its BID number in black and Load Deal Documents pulses.
- Running a search shows green progress and leaves Bid Information open.

## Technical notes

- `WorkspaceTaskbar.activate("new")` navigates to `/live-deal-engine?fresh=true`, which is a no-op
  when already there; add a changing nonce to the search params (validated in the route) and include
  it in the reset effect's dependency list so the reset re-runs on every press.
- `MapView.tsx`: `Step 5 · Memory` text class → `text-[11px]`; `BOXES.entryExit.h` → match
  `BOXES.search.h`; reduce `H` and the y-offsets of `COMPLIANCE_FRAME`/`EXECUTION_FRAME`/
  `ENTRY_EXIT_FRAME`/`FINALITY_FRAME` and their boxes (and the memory circle) so the content ends
  well within the canvas; connector waypoints (`y: 395`, `y: 844`) move with them.
- Progress bars: `bg-primary` in the searching bar in `MapView.tsx`, and `bg-info` in
  `DealCanvas.tsx` media/screening bars → `bg-success` (destructive on failure unchanged).
- `nodeState` in `MapView.tsx`: with a bid recorded but no documents, `bid-offer` reads done and
  `documents` is the active/pulsing tile; the Bid tile renders `tx.reference` as a black sub-line
  inside the tile.
- `live-deal-engine.tsx`: the search handlers currently call `setBidInfoCollapsed(txId, true)` —
  change to `false` so the section is open after a search.
