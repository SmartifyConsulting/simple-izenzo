# BID9938656: counterparty side should match the bidder's screen

## What's wrong
BID9938656 is already recorded at Step 3 · Execution (Concept). Both parties are verified and Without a Doubt is complete. The deal data is correct. The problem is only on the counterparty's screen (Holarc Health):
- The Legal Agreements frame is shown on its own, open, instead of folded into Step 2 · GRC.
- There is no Step 3 · Execution section, so the Concept frame never appears.

The bidder's screen already works this way. The counterparty screen was never given the same sections.

## What changes (counterparty screen only)
1. **Step 2 · GRC folded away:** The yellow Step 2 · GRC bar shows once every legal agreement is signed by both parties. It starts collapsed, with a green check. Proof of Intent, the Offer, Without a Doubt and Legal Agreements all sit inside it, and you can still open it to review them.
2. **Step 3 · Execution open:** Below it is the dark Step 3 · Execution bar, open by default. It shows the Concept frame with the AI deal summary, read-only for the counterparty.
3. **Phase 1 ends there:** The Concept frame shows "Phase 1 ends here — Execution continues in Phase 2." Its Continue button is greyed out and can't be clicked.
4. **Map:** Legal Agreements shows as done and Concept pulses as the current step, the same as on the bidder's map.
5. **Congratulations banner:** It shows once, then fades on its own.

Nothing changes on the bidder's screen or in the deal's saved records.

## Also: "All" pill in the Inbox
- A new **All** pill sits next to Inbox and Archive. It lists every message, new and read, with its count.
- New messages stay green and read ones stay black (white in dark mode). The Mark Read and Restore buttons work the same as they do now.

## Technical details
- `src/components/canvas/CounterpartyWorkspaceView.tsx`: add `grcDone = tx.stage === "execution" || legalAllSigned`.
  - Once `grcDone` is true, wrap the Proof of Intent, Offer, WaD and Legal Agreements frames in a collapsible "Step 2 · GRC" pill (`bg-warning`, `CheckCircle`), which is collapsed by default.
  - Add a "Step 3 · Execution" pill, styled like `live-deal-engine.tsx:3570-3592`, that renders `<InlineFrame viewOnly stage="execution" step="preparation">`.
- Confirm that `StepScreen` preparation (around line 2893) keeps Continue disabled when `viewOnly`.
- `mapOverrides`: set `businessDocs` to "done" when `tx.stage === "execution"`, and mark concept/preparation as "active".
- Check in Playwright as Holarc Health on BID9938656, in light and dark mode.
