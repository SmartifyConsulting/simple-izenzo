# Deal ID, default view, icon-only menu, and the stuck Choice step

## 1. Stuck on "Choice recorded" — never reaches Proof of Intent

There are two different "choose the counterparty" actions in the app and they behave
differently:

- The one on the workflow screen records the choice and opens Intent sign-off on the right
  ("Choice recorded — confirm the intent to continue").
- The older Choice panel opened from the workflow node records the choice and moves the deal to
  Background screening instead, with no next panel — that dead end matches "stuck on Choice
  recorded".

First step is to confirm which of the two the deal is sitting on by checking the deal's recorded
stage/step. Then:

- Make the older Choice panel end the same way as the main flow: record the choice, move the deal
  on, and open the Intent sign-off panel so the user can sign and continue to Proof of Intent.
- Add a safety net so that any deal with a chosen counterparty always shows the next open panel
  (Intent, then Proof of Intent) rather than nothing — including after a page refresh.
- If the deal is already past the choice, show an explicit "Continue to Intent" action instead of
  leaving the screen static.

## 2. Show the Bid / Offer ID in the Live Workspace

Add the deal's reference (e.g. BID9089722) at the top right of the Live Workspace grid, on the
same line as the "Live workspace" label, as a small pill. Absent when no deal is registered yet.

## 3. Classic View becomes the default, and the logo returns to it

- New sessions open in Classic View (start node plus the full workflow beneath it), not the
  Mahjong map.
- Clicking the Izenzo logo goes to the workflow screen in the user's current view, defaulting to
  Classic.
- The header toggle still switches between Classic and Mahjong and sticks for the session.

## 4. Menu icons lose their text labels

The header nav becomes icon-only everywhere: the view toggle drops its "Classic View" /
"Mahjong View" wording. Every icon keeps a hover tooltip and accessible label.

## Technical notes

- Diagnose first: read the transaction's `stage`/`step` and the `counterparties.status = chosen`
  row for the affected deal before changing behaviour.
- `src/components/steps/StepScreen.tsx` — `ChoiceStep.choose()` currently calls
  `advance(tx.id, "trading", "media")` and stops; align it with `finalizeChoice` in
  `_authenticated.live-deal-engine.tsx` (advance to `trading/intent`, open the Intent panel).
- `src/routes/_authenticated.live-deal-engine.tsx` — in `reloadDeal()`, also open `intent` when a
  chosen counterparty exists and `intent_confirmed_at` is null, regardless of the stored step.
- `src/lib/viewMode.ts` — default and fallback change from `mahjong` to `classic`.
- `src/components/layout/AppShell.tsx` — toggle renders icon only with `title`/`aria-label`.
- Live Workspace header: flex row with `dealTx?.reference` pill on the right.
