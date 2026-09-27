# Step 3 · Execution shows as a heading only, and Trade Summary is removed

## What changes
1. **Both screens show only the Step 3 heading.** Once both parties have signed every Legal Agreement, the bidder and the counterparty each see the black "Step 3 · Execution" bar with the BID number on the right, and nothing under it. The bar has no arrow and doesn't open, so the Project Preparation frame and its questions no longer show for either party. Phase 1 ends at this bar.
2. **The bidder no longer lands on Without a Doubt.** When BID9640523 is reopened after the Legal Agreements are signed, the bidder's screen no longer shows the Without a Doubt frame with Exit and Continue. Step 2 · GRC stays folded and the Step 3 heading sits below it, the same as on the counterparty's screen.
3. **Trade Summary is removed** from the Live Workspace. The Activity Log in Admin already keeps that history.

Deal records, signatures and all gates stay exactly as they are.

## Technical details
- `src/routes/_authenticated.live-deal-engine.tsx`:
  - Delete the Trade Summary block (~3549-3573), the `tradeSummaryOpen` state and its setters (672, 1119, 1980), and the `TradeSummary` import.
  - Turn the Step 3 button (~3575) into a static `div` styled like the counterparty's bar, with `dealTx.reference` on the right and no chevron or +/−. Remove the `step3Open && <InlineFrame … preparation>` render.
  - When `grcDone` is true, make sure `stagePanel` or the opening frame doesn't reopen `wad`. Clear `stagePanel` so that nothing inside Step 2 is expanded. Check this against `openingFrameFor` and `resumedStep`.
- `src/components/canvas/CounterpartyWorkspaceView.tsx` (609-625): make the bar static, drop the chevron and the `step3Open` InlineFrame, and delete the unused state.
- `src/components/canvas/TradeSummary.tsx`: delete it.
- Check in Playwright on BID9640523 as the bidder and as Holarc Health.
