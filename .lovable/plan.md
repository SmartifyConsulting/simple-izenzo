# Fix background screening, tidy the results, and the missing BID9089722

## What is actually happening

Checked the live data for the Copper deal. Every screening run did reach Didit: three
checks were opened for each of Anker Innovations and EnerSys at 22:35, 22:49 and 23:05.
All of them are still sitting at "in progress" — Didit's ID, company and sanctions
sessions are hosted links a person has to open and complete, and until someone does,
Didit sends nothing back. So there is genuinely nothing to report yet.

Two separate display faults on top of that:

- The progress bar counts counterparties, not checks. With two counterparties it goes
  0 → 1 → 2 in a blink and then reads "2 of 2 checks complete", which is wrong wording
  and wrong maths (there were 8 checks).
- The panel takes one snapshot when the run starts and never looks again, so even when a
  check does finish the line keeps saying "in progress".

## The fix

1. **Honest progress.** Count every check across every counterparty (registry + ID +
   company + sanctions), and advance the bar as each one is opened. Label it
   "6 of 8 checks opened" while running, then "waiting on 6 results" once opened.

2. **Live results.** After the run, keep watching the stored verification records for
   that deal and update each line the moment a result lands — no reload, no re-run.
   Reopening the deal later shows the current state instead of a blank panel.

3. **Make the checks completable.** Each pending Didit line gets an "Open check" link to
   its hosted session, so the check can actually be finished, plus a "Refresh" action
   that pulls the latest decision from Didit in case the callback was missed.

4. **Better formatting** (matching the screenshot complaint): one bordered card per
   counterparty with its name and match score as a header, then a row per check —
   check name on the left, a coloured status pill (green pass, amber waiting, grey not
   connected, red failed) on the right, and the detail as small wrapped text underneath
   rather than a run-on line. Registry hits list one company per line instead of a single
   pipe-separated string.

5. **The "Continue / pick who you want to trade with" step** stays available once every
   check has either returned or is clearly waiting, so a pending Didit session never
   blocks the deal — it just shows as outstanding.

## Why BID9089722 is not in All Trades

The deal number is generated in the browser when the bid is recorded and then only kept
locally — the database has no `reference` column, so the insert quietly drops it. The All
Trades list, having nothing stored, computes a different number from the deal's id. Same
deal, two different numbers, so searching BID9089722 finds nothing.

Fix: add a `reference` column, save the generated number when a bid/offer is recorded,
and backfill every existing deal with the same number the lists already display, so the
number on the canvas, in Search, and in All Trades is one and the same from now on.
Existing deals keep the number they currently show in All Trades; the locally generated
BID9089722 will be replaced by that deal's stored number.

## Technical notes

- `src/routes/_authenticated.live-deal-engine.tsx`: per-check progress counting; keep a
  live query on `identity_verifications` filtered by `transaction_id` while the panel is
  open and merge it into `screeningResults`.
- `src/components/canvas/DealCanvas.tsx`: rework the `CounterpartyRecord` screening block
  into the card/pill layout; add Open/Refresh actions using the existing
  `refreshVerification` server function; PDF export follows the same grouping.
- `src/lib/screening.functions.ts`: return the verification row id and `provider_url` per
  check so the UI can link and poll; no change to gates, token costs, or the deal step.
- Migration: `alter table public.transactions add column reference text` (nullable,
  indexed), backfill using the existing deterministic BID/OFF rule, then regenerate types
  and drop the "column may not exist" fallbacks in `DealCanvas` and `SearchButton`.
