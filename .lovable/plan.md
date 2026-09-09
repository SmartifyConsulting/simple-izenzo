# Fix "new row violates row-level security policy for table transactions"

## What is actually wrong

The error is not about the form you filled in. The account you are signed in as has no
profile record in the database, and the app decides which company you belong to by reading
that record. With it missing, the database sees you as belonging to no company and refuses
to save the deal.

Confirmed by checking the data: three sign-in accounts exist, but only one of them
(`izenzo.qa.wizard@example.com`) has a profile row. `georgia.adams@smartify.co.za` and
`canvas.qa.tester@example.com` have none.

There is a second, related bug: when the app tries to give a user a company on the fly, it
updates their profile record — but if no profile record exists, that update quietly changes
nothing, so the account still ends up with no company and the save fails anyway.

## Fix

1. Backfill the missing profile records for existing sign-in accounts, filling in name,
   company, seat and roles from the pending-people list imported earlier where the email
   matches; otherwise create a plain profile.
2. Give each of those accounts a company: attach to the matching company from the imported
   data when there is one, otherwise create a personal one and add them as owner.
3. Change the on-the-fly company setup so it creates the profile record if it is missing
   instead of updating nothing, and so it reports a clear message rather than failing
   silently.
4. Re-check as Georgia that a new deal saves, and that the dashboard, deals and registry
   screens show data.

## Technical notes

- `transactions` INSERT policy is `org_id = current_org_id()`; `current_org_id()` reads
  `profiles.org_id` for `auth.uid()`, which returns NULL for users with no profile row.
- Backfill runs as a migration over `auth.users` left-joined to `public.profiles`, reusing
  `public.pending_user_links` for name/org/role attachment, mirroring `handle_new_user()`.
  No schema, policy, gate, token or workflow change.
- `src/lib/org.ts` `ensureOrg`: replace the `profiles` update with an upsert on `id`, and
  surface an error when no row is written.

## Not changed

Database structure, RLS policy definitions, deal workflow, gates, token costs, permissions.
