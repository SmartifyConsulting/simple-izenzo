# Map view as a working, option-B interface

The Map becomes a fully usable way to run a deal, driven by pulsing tiles instead of the vertical step list. Nothing else is removed — the Live Workspace list view stays exactly as it is, so both can be shown to the client.

## 1. Bottom of the screen on the Map

- The strip of open bid tabs no longer appears while the Map is on display.
- The Map shows the normal site footer at the bottom instead, like the other pages.
- Every other screen keeps the tab strip exactly as it is today.

## 2. Running a deal from the Map

- On opening the Map, **Bid** pulses as the thing to do next.
- Clicking Bid opens the Live Workspace on the right-hand side of the screen; the Map stays on the left and shrinks to fit.
- From then on the workflow behaves exactly as it does now — same steps, same gates, same actions — but the "where am I" indication is the pulsing tile on the Map, not a vertical stepper.
- Once the bid is registered, **Load Deal Documents** pulses.
- Clicking Load Deal Documents opens a centred window containing the Search Prompt field and the upload-documents frame (the same one used in the workspace today).
- Pressing Search closes that window, and the **Search** tile begins pulsing, with a progress bar for AI and AI+ shown beneath the tile.
- The results appear on the right in the Live Workspace as they land, and the pulse then moves on to the next step (Choice) as usual.
- Locked tiles stay dim and unclickable with their existing reasons; cleared tiles stay green with a tick.

## 3. Map drawing fixes

- Remove the overlapping lines running from the Step 1–5 card across to Choice — one clean connector only.
- Put BID, Load Deal Documents, the Search frame (AI and AI+) and the Step 1–5 card inside a single outer frame labelled **1. TRADE ENGINE**, replacing the loose "1. Trading Engine" text label and the small frame that currently sits around Search alone.

## Technical notes

- `src/components/canvas/WorkspaceTaskbar.tsx`: treat `/map` like the marketing paths so the taskbar returns null there; `src/routes/_authenticated.map.tsx` renders `AppShell` with the footer shown (`compactFooter`) and `wide`.
- `_authenticated.map.tsx` becomes a two-pane layout: Map on the left, and when a deal pane is requested, the existing Live Workspace content on the right (routed via the existing `/live-deal-engine` window with `popout` styling, or an embedded render of the same workspace component) at roughly 45% width; single-pane until Bid is clicked.
- `MapView` gains callbacks: `onRegister` (Bid tile, no deal yet → opens the registration workspace on the right) and `onOpenUpload` (Load Deal Documents → modal hosting `DocumentUploadStep` with the Search Prompt field). The modal closes on submit and the Search tile enters a `searching` state that renders a progress bar beneath its box.
- Pulse targets keep coming from `lockReason`/`stepIndex`/`SPINE` plus the same `stepOverrides` logic the list view uses; no spine or gating changes, no database changes.
- `ARROWS` in `MapView.tsx`: drop the duplicate `steps → offer` elbow and keep a single `steps → choice` line; add a `TRADE_ENGINE_FRAME` box wrapping bid/loadDocs/search/steps with the label "1. Trade Engine", and remove `TRADING_SEARCH_FRAME` and the loose trading side label.
