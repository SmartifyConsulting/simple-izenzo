# Tester activity spreadsheet

Make a downloadable Excel file from the activity log (12–29 Sep 2026, SA time). The app itself does not change.

## Contents
- **Summary sheet**: one row per person (all 20), with name, email, days active, total minutes, total hours, first day and last day. Totals are live formulas that add up from the daily sheet.
- **Daily sheet**: one row per person per day, with name, email, date, number of visits, first seen, last seen, minutes and number of actions.
- Accounts with no name on their profile are listed by email. If an account has no email either, it is marked "(no email)".

## How time is counted
- A new visit starts after 30 minutes with no activity.
- Visit length runs from the first action to the last action.

## Technical notes
- Pull the data from `user_activity_log` joined to `profiles` (full_name, last_name, email) and group it into visits using 30-minute gaps.
- Build the file with openpyxl, using SUMIF/COUNTIF formulas on the Summary sheet, then recalculate and check it for errors.
- Save it to Files as `tester-activity-report.xlsx`.
