# Map inside the vertical stepper, restyled

The client wants the map to live with the vertical stepper rather than on its own screen, and to look properly designed instead of rudimentary. The attached sample sets the style: dark surface, thin mint outlined rounded frames, teal icons and labels, orange hard-gate notes, straight arrows with small arrowheads, and group frames labelled with a small caps chip.

## What changes

1. **The map moves into the workflow column.** On the Live Workspace, the "Izenzo Trade Workflow" panel gets the map at the top of the column, above the vertical step list, in the same scrolling area. The step list stays exactly as it is; the map is the visual "where am I" companion, with the same pulsing/ticked/locked states, and clicking a tile opens the same step frame the list opens. A small show/hide control lets it be folded away, remembered per bid.

2. **The Map screen and its menu tab go.** `/map` is removed and "Map" is dropped from the menu, so Home is first again. The bottom tab strip behaves as it did before the Map screen existed. Nothing else about the Live Workspace or the other interfaces changes.

3. **Padding between frame 1 and frame 2.** Clear breathing room between the Trade Engine frame and the Compliance & Governance frame, instead of them nearly touching.

4. **Offer, Choice, Counter Offer and Social Media join Step 1.** Their own surrounding frame is removed and the four tiles sit inside the Trade Engine (Step 1) frame, keeping their current positions relative to one another. The frame widens to hold them.

5. **Elegant, straight lines.** Every connector becomes a straight run — vertical or horizontal, with clean right-angle turns where a turn is needed — thin, evenly weighted, with small neat arrowheads that stop on the box edge. No diagonals, no crossings, no doubled-up lines.

6. **Restyled to the sample.** Frames and tiles become thin single-stroke rounded outlines on the app surface rather than filled pastel blocks: mint/teal outline and label, icon to the left of the tile name, group frames labelled with a small caps chip on the frame's top edge (`STEP 1 · TRADING`, `STEP 2 · COMPLIANCE & GOVERNANCE`, and so on), hard-gate notes in orange beneath the tile name (as with Without a Doubt). Cleared tiles read green with a tick, the current tile pulses, locked tiles stay dim with their existing lock reason on hover.

7. **The sample is the dark-mode look.** The teal-on-black treatment in the sample is the black/dark theme. It is drawn with the app's own theme tokens rather than fixed colours, so the cream theme gets the same structure in its own palette — royal blue lines and labels on cream, the same thin outlines, the same orange hard-gate notes — instead of a dark diagram dropped onto a light page.

## Technical notes

- `src/components/canvas/MapView.tsx`: keep `nodeState`/`lockReason`/`stepIndex` wiring and `InlineFrame` handling untouched; rework `BOXES`, the group frames and `ARROWS` on a re-proportioned canvas (Trade Engine frame absorbs offer/choice/counterOffer/socialMedia, `COUNTERPARTY_FRAME` deleted, vertical gap added before `COMPLIANCE_FRAME`), replace pastel fill constants with token-based outline styles, and restrict connector geometry to `line`/`elbow` runs only.
- New props on `MapView` for the embedded use: accept the same `overrideStates` the step list receives and an `onOpenStep` callback, so an embedded map defers to the workspace panel rather than opening its own inline frame.
- `src/routes/_authenticated.live-deal-engine.tsx` (~1342-1359): render `MapView` above `ClassicView` in the workflow column, sharing `stepOverrides`, `openMapStep` and `reloadDeal`; add the collapse control with per-bid `sessionStorage` state.
- Delete `src/routes/_authenticated.map.tsx`; remove `{ to: "/map", label: "Map" }` from `NAV` in `src/components/layout/MainHeader.tsx`; revert the `/map` branches in `src/components/canvas/WorkspaceTaskbar.tsx` (`activate`, `openDeal`, `DealSearchDialog` `onPick`) to their live-deal-engine behaviour.
- No spine, gating, database or server-function changes — presentation and routing only.
