# Merge the older project's database into this one

## What you need to do first

Attach the older project's `.backup` or `.sql` dump file to a message here. Nothing else is needed from you — no passwords, no keys.

If you don't have the file yet: open the older project, go to Cloud → Advanced settings → Export data, and download the dump.

## How the merge will work

1. **Read the dump without touching anything.** I list every table it contains and compare it against what this app already has, then show you the comparison: tables in both, tables only in the old project, and row counts for each.
2. **Add the missing tables.** Every table that exists only in the old project gets recreated here exactly as it was — columns, types, relationships between tables, indexes and access rules — including ones no screen reads yet.
3. **Load rows, existing data wins.** For tables that exist in both, current rows stay untouched and only rows that aren't already here get added. For the new tables, everything loads. Original record IDs are kept so all the links between companies, deals, documents and history survive.
4. **Load in the right order** so a record never lands before the thing it points at.
5. **Check and report.** Row counts per table before and after, plus a spot check that key screens still open.

## What cannot come across

Sign-in accounts and passwords stay behind — those are locked in the old system. Anything tied to a person (their profile, roles, company memberships) loads only for accounts that already exist here, matched on the same ID or email address. The rest is held aside and reconnects automatically the moment each person signs up with the same email. I'll list exactly who is waiting.

## Technical notes

- `pg_restore -l` identifies the dump format; data is extracted with `pg_restore -a` (or read directly for a plain `.sql` dump) and replayed through `run_sql`. No dump is ever executed straight against the database.
- Schema for old-only tables is recreated through migrations, in dependency order, each with `GRANT`s, `ENABLE ROW LEVEL SECURITY` and policies mirroring the old ones (or matching the equivalent policy pattern already used here where the old ones don't translate).
- Enum types present in the dump but missing here are created first; label sets are diffed before use.
- Row loading uses `INSERT ... ON CONFLICT (id) DO NOTHING` so current data always wins and re-runs are safe.
- `profiles`, `org_members` and `user_roles` are filtered to IDs present in this project's `auth.users`; the remainder go into `pending_user_links` for automatic reattachment on signup.
- Only the `public` schema is touched; `auth`, `storage` and `realtime` sections of the dump are skipped.
- If the two schemas disagree on a shared table (a column present in one and not the other), I add the missing column rather than dropping or altering anything that exists.
- Nothing is deleted at any point in this merge.
