# Cleared gates turn green, and you can change your mind about the party

Two changes to the deal workflow.

## 1. Cleared gate labels go green

Today the "Proof of Intent to be cleared" and "Without a Doubt to be cleared" bars are orange, and once the gate is passed the whole section folds into a green tick list with no coloured label at all.

After this change:

- The moment Proof of Intent is sealed, its label reads "Proof of Intent · cleared" in green.
- The same for Without a Doubt once it clears.
- The green label sits at the top of the folded tick list, so each finished stage keeps a visible green marker instead of losing its label.
- Still-open gates stay orange exactly as now.

## 2. Change the party you chose

A "Choose a different party" action appears on the Intent sign-off panel and on the Proof of Intent panel (before payment).

- Clicking it asks for confirmation, then reopens the counterparty list with your shortlist and screening results intact.
- Your previous pick is released, the unsigned intent is cleared, and the deal returns to the choice step.
- Every change is written to the deal's activity trail so the history shows the party was swapped and when.
- Once Proof of Intent has been sealed and paid for, the action is no longer offered — the sealed certificate names the party, so at that point the deal has to run its course rather than quietly swap counterparties.

## Technical notes

- `GateBar` in `src/components/canvas/CanvasNode.tsx`: cleared state changes from `primary` tones to emerald tones.
- `src/components/canvas/DealCanvas.tsx`: the folded POI and WaD summary blocks render a cleared `GateBar` (or an equivalent green pill) in place of the muted `label-caps` heading.
- New handler in `src/routes/_authenticated.live-deal-engine.tsx`: reset `counterparties.status` from `chosen` back to `screened` and null `chosen_at` for the deal, null `transactions.intent_confirmed_at`, `advance(tx, "trading", "media")`, `recordEvent` with action `counterparty_choice_reopened`, then `setStagePanel(null)` so `CounterpartyRecord` renders again.
- The button is passed into `InlineFrame` (`StepScreen`) for the `intent` and `poi` steps and is hidden when `poi_sealed_at` is set; the existing resume logic in `reloadDeal` already keys off `intent_confirmed_at`, so clearing it keeps the resume path consistent.
