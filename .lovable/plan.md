# Load the uploaded backup into this app

## Where the backup is now

The file `vertical-trade-steps_260908.backup` you uploaded is sitting in this workspace, untouched. Nothing from it has been loaded into the app's database yet — that is why every screen is still empty. This app's database currently has zero companies, zero deals and zero people.

## What's inside it

| Records | Count |
|---|---|
| Deals | 37 |
| Deal history entries | 40 |
| Companies | 27 |
| Bids and offers | 18 |
| Token ledger entries | 36 |
| People (profiles) | 18 |
| Role assignments | 26 |
| Company memberships | 10 |
| Activity log entries | 41 |
| Execution records, counterparties, documents, compliance cases, registry companies, notifications, funder records, support tickets, API keys and logs | smaller sets, all included |

## What I'll do

1. Read the backup and pull out the records for every business table, keeping the original IDs so deals, companies, documents and history stay linked exactly as they were.
2. Clear the (currently empty) tables first so there's no chance of duplicates, then load everything in the right order — companies first, then deals, then everything hanging off them.
3. Attach people's records to the sign-in accounts already in this app where the IDs and emails match — Georgia Adams and Jane Doe both carry the same IDs in the backup, so their profiles, roles, companies and deals reconnect straight away.
4. Park the remaining people (James, David, Daniel, Hanish and the test accounts) — their profiles, roles and memberships can't attach until those accounts exist here. I'll hold their rows and reconnect each one the moment they sign up with the same email, and I'll tell you exactly who is waiting.
5. Anything that points at a person who isn't here yet (a deal created by them, an activity entry) still loads — only the person-linked profile row waits.

## What can't come across

Passwords and sign-in accounts stay behind in the old system; those are locked and can't be copied. Everyone signs up again with the same email address, and their history is already waiting for them.

## Technical notes

- The upload is a PostgreSQL custom-format dump (`pg_restore -l` confirms it). I'll extract data-only SQL with `pg_restore -a`, then replay the `public` schema rows through `run_sql` in dependency order.
- Only `public` tables are touched. The `auth`, `storage` and `realtime` sections of the dump are skipped — `auth` is managed and cannot be written to.
- `profiles` and `org_members` have foreign keys to `auth.users`, so those rows are filtered to user IDs that exist in this project's `auth.users`; the rest are held back for a follow-up pass.
- `user_roles` likewise, preserving the separate roles table and the `is_platform_superuser` protection on Georgia's admin row.
- Enum-typed columns (`spine_stage`, `app_role`, `compliance_case_status`, etc.) already exist here with matching labels — verified against the current schema, so no schema migration is needed.
- Load order: `organisations` → `profiles`/`org_members`/`user_roles` → `transactions` → `transaction_events`, `bid_offers`, `documents`, `counterparties`, `ai_proposals`, `wad_cases`, `execution_records`, `stakeholder_events`, `finality_records`, `credit_ledger` → registry, compliance, funder, support, API and archive tables → `notifications`, `user_activity_log`.
- After loading I'll spot-check counts per table against the backup and confirm the deals list and a deal canvas render.
