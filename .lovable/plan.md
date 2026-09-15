# Choosing a party after online media screening, and a tighter gap above it

## 1. You can pick a party again

Once online media screening comes back, the "Online Media Screening Results" list currently shows
the parties but with no selection circles and no button, so there is no way on. Cause: the moment
screening starts, the workspace marks the choice step as "moved past", and that same flag is what
hides the circles and the confirm button on that list — so the controls disappear before you ever
get to use them.

After the fix:

- The screening results list opens itself as soon as screening finishes.
- Each listed party has a selection circle, and the button under the list reads "Elect to proceed —
  Confirm Intent", enabled once one is picked. Both stay available until a party has actually been
  recorded as chosen for this bid (not merely because screening was run).
- If screening comes back with no parties at all, the list says so and the choice controls stay on
  the search results above, so the bid is never left with nothing to click.
- Only one set of selection controls shows: the ones on the screening results list. The duplicate
  circles/Continue button inside the Choose Counterparty frame's own copy of the screening records
  are removed so there is no second, conflicting place to pick.

## 2. The frame renames itself once a party is chosen

Once a counterparty has been chosen, the frame's pill reads **Chosen Counterparty** (instead of
Choose Counterparty), and it folds closed as it does today. Before any pick it still reads Choose
Counterparty, and before screening it reads Search Results.

## 3. Tighter space between Bid Information and Choose Counterparty

An always-present empty row sits between them (the slot that holds the upload control for a bid with
no documents yet) and it adds a gap once the upload control is gone. That row only renders when it
actually has something in it, so Choose Counterparty sits the same small distance below Bid
Information as Bid Information sits below Bid Registration.

## Technical detail

- `src/routes/_authenticated.live-deal-engine.tsx`
  - Online Media Screening Results frame (~2300–2385): replace the `!hasChosen` gates on the
    `RadioGroup` (`disabled`), the `RadioGroupItem` render, and the Elect button block with
    `!dbHasChosenParty`; add an effect that calls `setMediaResultsOpen(dealTx.id, true)` when
    `choicePending` becomes true so the list is open when the pick is needed.
  - Empty-results case: when `mediaResults` is non-null but empty, render the frame with a
    "Screening returned no records" line instead of the radio list.
  - Right-hand column row (~2088–2134): wrap in the same condition its only child uses
    (`workspaceDocs.length === 0 && !submittedForThisBid && !workspaceDocsPending`) so no empty
    `mt-1` flex row is left behind.
- `src/components/canvas/DealCanvas.tsx` (`CounterpartyRecord`): in the internal media accordion
  (~1490–1509) drop the `RadioGroupItem`/`Checkbox` column and the `screeningDone && onFinalize`
  Continue button (~1747–1762), leaving that accordion as a read-only record. `mediaResults`
  non-empty with zero candidates still renders the search-results record as today.
- No changes to screening logic, gates, scoring or token costs.
