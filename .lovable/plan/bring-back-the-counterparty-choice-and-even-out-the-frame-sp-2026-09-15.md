# Bring back the counterparty choice, and even out the frame spacing

## 1. Choosing a counterparty after Online Media Screening

The choice control still exists in the code, but it is now unreachable: the frame that holds it
("Search Results") defaults to **closed** as soon as online media screening starts, and the frame
itself is hidden whenever another gate panel (Express Intent) has been opened. So once screening
finishes there is nothing on screen to pick with, and no Continue button.

What changes:

- When media screening has finished and no party has been chosen yet, the frame that carries the
  selection always shows and opens by default instead of staying folded.
- Its label reads "Choose Counterparty" in that state (it stays "Search Results" once a party has
  been chosen), so it is obvious that a decision is waiting.
- The circle selectors on each screened counterparty and the Continue button below them are visible
  in that state, and the online media screening list inside it stays open.
- Picking a party and pressing Continue behaves exactly as before: the choice is recorded and
  Express Intent opens next. Changing party later still reopens the same choice frame.

## 2. Equal spacing between all Live Workspace frames

The gap between Bid Registration and Bid Information (6px) becomes the single spacing used between
every frame in the Live Workspace: the pinned top block and what follows it, the workflow map /
steps panel, the search progress frame, Search Results, Online Media Screening Results, Confirmed
Intent, the gate panels (Intent, Proof of Intent, Without a Doubt, Business Docs) and Trade Summary.
No frame keeps a larger or smaller gap than its neighbours.

## Technical notes

- `src/routes/_authenticated.live-deal-engine.tsx`
  - Derive a `choicePending` condition (media results present, not running, no chosen party) and use
    it to (a) render the Search Results frame regardless of `stagePanel`, (b) default
    `searchResultsOpen` to true, (c) switch the pill label.
  - Normalise spacing: sticky header `mb-3` → `mb-1.5`, and the `mt-2` / `mt-4` frame offsets
    (lines ~2061, 2126, 2131, 2323) plus the `space-y-1.5` stack to a single 1.5 rhythm.
- `src/components/canvas/DealCanvas.tsx` (`CounterpartyRecord`) — keep the media-results accordion
  expanded while a choice is pending and restore the "Select who you want to trade with" heading in
  that state; no change to `screeningDone`, `onFinalize` or shortlist behaviour.
- No database, server function or workflow-gating changes.
