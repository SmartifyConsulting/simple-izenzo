# Fix: matches found but never shown after "Submit"

## What's actually happening

The AI search is working. After the last submit at 20:32 today, 11 candidate
counterparties were created and saved against your Copper deal (5 from AI, 6 from AI+),
each with a score. Both AI calls returned successfully.

The problem is on screen only: the "Record" panel loads its list once, at the moment the
search starts — when there are still zero results — and then never reloads. So it stays on
"Searching for counterparties…" even after the matches land.

## The fix

1. Refresh the Record list as soon as the search finishes, and again while it is running,
   so results appear the moment they are saved.
2. Give the panel honest states: "Searching…" while the search runs, the ranked list when
   results arrive, and a clear "No matches found — try again" message only when the search
   genuinely returned nothing.
3. Surface a failure properly: if both AI and AI+ fail, show the reason in the panel instead
   of an endless searching message.
4. Reopening the deal later shows the saved matches immediately, including the 11 already
   stored for the Copper deal.

## Technical detail

- `runSearch` in `src/routes/_authenticated.live-deal-engine.tsx` calls the
  `searchCounterparties` server function, which inserts rows into `counterparties`, but never
  invalidates the `["counterparties", txId]` React Query cache.
- Add `queryClient.invalidateQueries({ queryKey: ["counterparties", txId] })` after the search
  settles, plus a short polling interval on that query in `CounterpartyRecord`
  (`src/components/canvas/DealCanvas.tsx`) while the flow step is "searching".
- Split `CounterpartyRecord`'s empty state into searching / empty / error via a new optional
  prop, instead of always rendering "Searching for counterparties…".

No changes to the database, RLS, gates, token costs, or workflow rules.
