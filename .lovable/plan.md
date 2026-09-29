# Tester report v2: name the deleted testers

Make a new version of the spreadsheet, `tester-activity-report_v2.xlsx`. The original file stays as it is. The app does not change.

## Changes
- In the Summary and Daily tabs, give the deleted accounts that opened deals a name, based on the counterparty in their deals:
  - a3a52178 and d140a939 (Amrod) → Anastasia Kendricks (Amrod)
  - ca25972c (SeedAxis) → Hanish Gupta (SeedAxis)
  - 92d2c9b6 (Holarc Health) → Georgia Adams (Holarc Health)
- The other six deleted accounts, which opened no deals, are shown as "Deleted account (no deals)".
- Add a new **Deal progress** tab with one row per named tester: person, counterparty, their furthest deal and the last step it reached.
  - Anastasia Kendricks, Amrod, BID9500018, Execution (entry)
  - Anastasia Kendricks, Amrod, BID9428774, Without a Doubt (second account)
  - Hanish Gupta, SeedAxis, BID9633870, Without a Doubt
  - Georgia Adams, Holarc Health, BID9477215, Execution (preparation)
- Add a note that the steps come from each deal's own record, so they may include the other party's progress.

## Technical notes
- Reuse `/tmp/rep/d.csv`. Map each "(no email) <id8>" row to its label, rebuild the Summary formulas, recalculate and check for errors, then save to `/mnt/documents/tester-activity-report_v2.xlsx`.
