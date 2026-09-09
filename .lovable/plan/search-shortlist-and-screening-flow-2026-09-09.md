# Search, shortlist and screening flow

Make the search phase visibly guide the eye — Proof of Intent opens, the results frame throbs while matching runs, then the Choice step throbs — fix the shortlist error, and add a Continue button that fires the background screening checks.

## What changes

### 1. Fix the shortlist error
Ticking a result currently fails with "Could not find the 'shortlisted' column of 'counterparties'". The column was never added to the database. Add a simple yes/no `shortlisted` flag to the counterparties table (default: not shortlisted), so ticks save.

### 2. Proof of Intent opens automatically during search
The Proof of Intent group on the canvas is collapsed by default. While a search is running — and after it finishes — it opens on its own so the next steps are visible without clicking.

### 3. Throbbing states
- While the match search runs: the Record (results) frame pulses with a soft glow and shows "Searching for counterparties…".
- When results arrive: the Record frame stops pulsing and the Choice step on the canvas starts pulsing, drawing the eye to the next action.
- After Continue is pressed: the Background screening step pulses until every check has come back.

A single reusable pulse style is added alongside the existing canvas animations.

### 4. Results are checkboxes
The Record panel already uses checkboxes. The Choose-the-counterparty step still uses one "Choose" button per row; it stays a single final pick (that is a business rule), but its list is restyled to match the results list so the two read consistently. No change to how the choice is recorded.

### 5. Continue button on the Record frame
A Continue button appears at the bottom of the Record frame once at least one result is ticked. Pressing it:
- Records the shortlist against the deal (existing event log, no new rules).
- Advances nothing that would skip a gate — the deal moves only along its existing path.
- Kicks off background screening for each ticked counterparty:
  - Didit ID document + selfie check
  - Didit company (KYB) check
  - Sanctions / PEP (AML) screening
  - Registry / website lookup via Bright Data
- The Background screening frame pulses while these run, and each check shows its own result line (Verified / In progress / Needs review / Declined) as it lands.
- If a provider is not configured or errors, that check shows a clear message instead of failing the whole batch.

## Technical notes

- Migration: `ALTER TABLE public.counterparties ADD COLUMN shortlisted boolean NOT NULL DEFAULT false;` (existing grants and RLS via `can_access_tx` already cover it). Types regenerate afterwards, so the temporary cast in `setCounterpartyShortlist` (`src/lib/izenzo.functions.ts`) can be removed.
- `GateGroup` in `DealCanvas.tsx` gains a controlled `open` prop so the Proof of Intent group can be forced open from the search lifecycle; default collapsed behaviour is unchanged elsewhere.
- New `@utility animate-throb` in `src/styles.css` next to `animate-signal-pulse`.
- `CounterpartyRecord` gains `onContinue` plus a `screening` state; the Continue handler calls `startVerification` (`src/lib/didit.functions.ts`) for `id_document`, `kyb`, `aml` and `lookupCompanySite` (`src/lib/brightdata.functions.ts`) per ticked row, results rendered through the existing `VerificationPanel` conventions.
- Screening runs sequentially per counterparty with results written by the existing Didit webhook route; no new tables, no changes to gates, token costs, or workflow rules.
