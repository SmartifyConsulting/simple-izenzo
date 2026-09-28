# WaD Continue button, badge colours, Change Party button, dark-mode blue

## 1. Continue button missing on BID9477215
The saved records show both parties cleared for KYC and KYB, and Holarc Health is linked to the deal. But your screen still says "Holarc Health has not registered on Izenzo yet". So the screen is working from out-of-date deal details, not from what is saved. The cause isn't confirmed yet.

- First, open BID9477215 as the bidder in a test browser. Compare what the screen loads with what is saved.
- Fix the Without a Doubt screen so it always re-reads both parties' verification status and the counterparty link when it opens and after a refresh. Then Continue shows next to Exit, on the right, as soon as both parties are cleared.
- The "has not registered yet" line only shows when there really is no linked counterparty.
- Gates stay the same: Continue still needs both parties cleared and the 3-token payment. The flagged-rating warning stays.

## 2. "Both Verified" badge on Pre-Screening
Give it the same solid green pill with white text that the KYC and KYB "Both verified" badges use, in both light and dark mode.

## 3. "Change Party" on Online Scanning Results
Replace the small underlined link with the same outline button used on Proof of Intent (Seal Intent). The confirmation pop-up stays the same.

## 4. Royal blue in dark mode becomes sky blue
Everywhere royal blue shows in dark mode (counterparty pills, Offer tabs, the counterparty's side of Pre-Screening, map accents), switch to a bright sky blue so it stands out on black. Light mode keeps royal blue.

## Technical notes
- `StepScreen.tsx` WadStep: `counterpartyRegistered` reads `tx.counterparty_org_id`, and Continue reads `engagement.bothCleared`. Refetch the engagement query on mount and window focus with `staleTime: 0`. Take the linked state from `engagement.counterpartyLinked` as well as `tx`.
- Badge: `Badge` at ~line 2282 is changed to the same classes as the KYC/KYB "Both verified" pill.
- `_authenticated.live-deal-engine.tsx` ~line 3147: the `<button>` link becomes `<Button size="sm" variant="outline">`.
- Add a `--cp-blue` token in `src/styles.css` (royal blue in light mode, sky blue in dark mode, e.g. `oklch(0.75 0.14 230)`). Replace the hardcoded `#4169e1` uses (about 19 spots across StepScreen, VerificationPanel, WorkspaceTaskbar, CounterpartyWorkspaceView, MapView, DealCanvas, TradesListView, MutualEngagementPanel, Confetti, live-deal-engine) with it.
- Verify by opening BID9477215 in a test browser in light and dark mode.
