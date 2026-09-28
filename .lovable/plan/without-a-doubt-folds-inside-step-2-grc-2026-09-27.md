# Without a Doubt folds inside Step 2 · GRC

## What changes
- Once Step 2 · GRC folds, Without a Doubt folds away inside it, next to Proof of Intent, the Offer and Legal Agreements. It no longer shows open on its own, with or without Step 2's other frames.
- If you open Step 2 again, Without a Doubt shows as a closed record row: "Without a Doubt (WAD) — KYC, KYB, UBO, sanctions and PEP cleared." Its arrow opens it for viewing and closes it again, as often as you like, on both screens.
- Once the deal has moved on to Legal Agreements or beyond, that review is read-only: no Exit or Continue buttons, so it can't send you back into the step.
- The counterparty's screen works the same way.

## Technical details
- `src/routes/_authenticated.live-deal-engine.tsx`:
  - In the phase effect (~1338), when `phase === 3`, also reset `setSealedWadOpen(false)`, `setSealedPoiOpen(false)`, `setOfferFrameOpen(false)` and `setStagePanel(null)`.
  - Make the opening-frame logic (`openingFrameFor` → `sealedWad`) skip auto-opening WaD when `grcDone`, or when `wad_continued_at` is set.
  - In the sealed WaD `InlineFrame` (~3490), pass `viewOnly` and drop `onContinue` when `dealTx.wad_continued_at` or `grcDone` is set.
- `src/components/canvas/CounterpartyWorkspaceView.tsx`: check that WaD is rendered only inside the Step 2 · GRC collapsible, starts closed, and is `viewOnly` once `grcDone`.
- Check on BID9640523 in Playwright for both accounts.
