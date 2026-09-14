# Show the tab strip at the bottom of the Map screen

## What changes

The Map screen gets the same bottom tab strip the Live Workspace has: the half-width **New** tab,
the **Search** tab (find a bid by its ID or a keyword), and one tab per open bid, with the current
bid highlighted.

- Clicking a bid tab on the Map switches the map to that bid, so the pulsing tile and ticks follow
  the bid you picked — the same thing the deal picker above the map does.
- **New** opens an empty workspace on the right of the map, ready to register a new bid.
- **Search** opens the find-a-bid window, and choosing a result switches the map to that bid.
- The Map page keeps its compact footer; the tab strip sits above it so neither covers the other,
  and the map's own height is reduced slightly so nothing is hidden behind the strip.

Nothing else changes: the Live Workspace list view and every other screen stay exactly as they are.

## Technical notes

- `src/components/canvas/WorkspaceTaskbar.tsx`: remove `/map` from `isMarketingPath` so the dock
  renders there again.
- On the Map route the strip must drive the map's selected deal rather than navigate away: when the
  active window changes, `src/routes/_authenticated.map.tsx` reads the active deal window id (from
  `useDealWindows`) and uses it as the selected transaction, falling back to the most recent deal;
  a "new" window opens the right-hand workspace pane in registration mode.
- Bottom spacing: the map pane's height calculation gains the strip's height so the diagram is not
  clipped, and the route keeps `compactFooter`.
- Presentation and routing only — no database, policy or server-function changes.
