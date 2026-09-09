# Move the match progress bar and show real check results

## 1. Match progress bar belongs under Counterparties

Today the "Search complete — 11 matches found" bar sits in the right-hand results panel. Move it so it sits directly under the Counterparties box on the workflow diagram, exactly like the bar under Background screening: a thin bar plus one line of status text.

- Remove the bar and its status line from the results panel.
- Add a `matchProgress` input to the diagram (searching / finished / error / match count) and draw it under the Counterparties node.
- Wording stays the same: "Searching for counterparties…", "Search complete — 11 matches found", "Search complete — no matches found", or the failure reason.

## 2. Anker Innovations should read as matched, not waiting

Confirmed cause: every screening run opens a brand-new provider session for each check, even when that counterparty already has a finished result on file. The fresh session sits at "in progress", so the panel shows "Waiting" although Anker's ID, company and sanctions checks are all recorded as passed.

Fix: before opening a new check, reuse the most recent finished result (passed / failed / needs review) for that counterparty and check type, and show it straight away. Only open a new provider session when there is no finished result yet. Anker then shows all three items as passed, and EnerSys keeps its passed / needs-review mix.

## Technical notes

- `src/components/canvas/DealCanvas.tsx`: new `matchProgress` prop rendered beneath the `trading/counterparties` node using the same markup as `screeningProgress`; delete the progress block currently in `CounterpartyResults`.
- `src/routes/_authenticated.live-deal-engine.tsx`: pass searching/error/count state into `matchProgress`.
- `src/lib/screening.functions.ts`: query `identity_verifications` for the newest row per `subject_counterparty_id` + `check_type` with status in (passed, failed, review); return it as a completed check with its `verificationId` instead of inserting a new pending row. No schema, gate, token-cost or permission changes.
