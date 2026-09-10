# Fix "new row violates row-level security policy for table transactions"

## What is actually wrong

Confirmed by checking the live data, not guessed:

1. **New sign-ins get no profile record.** The database rule that was supposed to create a
   personal record for every new account is no longer attached, so nothing creates it. Three
   of the six accounts have no profile record at all: `dovedavies14@gmail.com`,
   `david@izenzo.co.za`, `claude.verify.session@example.com`.
2. **The app decides which company you belong to by reading that profile record.** With it
   missing, the database sees you as belonging to no company and refuses to save the deal —
   that is the exact error you are seeing.
3. **The on-the-fly company setup has a hole.** If an account is already listed as a member of
   a company but has no profile record, the code returns that company straight away and never
   writes the company onto the profile — so the save still fails. One account
   (`claude.verify.session@example.com`) is in exactly that state.

## Fix

1. Re-attach the automatic profile creation so every new sign-up gets a profile record again.
2. Create the missing profile records for the three existing accounts, filling in name and
   company from the pending-people list where the email matches.
3. Give each account with no company a company: attach the matching one where it exists,
   otherwise create a personal one and add them as owner.
4. Close the hole in the on-the-fly setup: when an account is already a member of a company
   but its profile has no company recorded, write it onto the profile before continuing.
5. Sign in and save a new deal to confirm the error is gone, and check the deals and registry
   screens show data.

## Technical notes

- `transactions` INSERT policy is `with_check (org_id = current_org_id())`; `current_org_id()`
  reads `profiles.org_id` for `auth.uid()` and returns NULL with no profile row.
- No trigger exists on `auth.users` (`pg_trigger` returns none) although
  `public.handle_new_user()` is still defined — recreate the `AFTER INSERT` trigger calling it.
- Backfill migration: insert into `public.profiles` for `auth.users` with no matching row,
  reusing `public.pending_user_links` on email for name/org/seat/roles, mirroring
  `handle_new_user()`; then create/attach an org and `org_members` owner row for any profile
  still having `org_id IS NULL`.
- `src/lib/org.ts` `ensureOrg`: in the early-return membership branch, upsert
  `profiles { id, org_id }` before returning instead of returning immediately.
- No schema change to `transactions`, no RLS policy rewrite, no workflow, gate or token change.

## Not changed

Database structure, RLS policy definitions, deal workflow, gates, token costs, permissions.
