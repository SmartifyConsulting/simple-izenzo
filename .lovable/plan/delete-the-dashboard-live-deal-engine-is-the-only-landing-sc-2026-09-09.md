# Delete the Dashboard — Live Deal Engine is the only landing screen

The "Dashboard" screen and its name disappear from the app. The screen you land on after signing in is the **Live Deal Engine** (the two-lane bidder/responder canvas), and nothing else takes its place.

## What changes

- The `/dashboard` address and page are removed completely — no redirect, no menu entry, no page title using that word.
- The live deal canvas lives at `/live-deal-engine` and is the one main screen of the app.
- Signing in, signing up, verifying an email and resetting a password all land there.
- The logo in the top bar, and the "back" links from a deal or a workflow step, all point to the Live Deal Engine.
- The menu entry currently labelled "Deals"/"Dashboard" becomes "Live Deal Engine".
- The public marketing home page at `/` is untouched; its "Create a Bid" and "Respond to a Bid" frames send people to the Live Deal Engine after sign-in.

## Unchanged

- The canvas content itself: bidder/responder lanes, document upload, counterparty search, gates.
- Database, workflow, gates, tokens, roles and permissions.
- Every other area (Inbox, Search Party, Registry, Funder, Auditor, Admin, Developer, Governance).

## Technical notes

- Rename `src/routes/_authenticated.dashboard.tsx` to `src/routes/_authenticated.live-deal-engine.tsx`; update its `createFileRoute` string to `/_authenticated/live-deal-engine` and its `head()` title/description to "Live Deal Engine — Izenzo". No `/dashboard` route file remains.
- Update every `/dashboard` reference to `/live-deal-engine`: `src/lib/useModules.ts` (also the `ModuleTo` union and the label), `AppShell.tsx`, `SiteHeader.tsx`, `GovernanceShell.tsx`, `DeveloperShell.tsx`, `SignInForm.tsx`, `SignUpForm.tsx`, `auth.tsx`, `index.tsx`, `verify-email.tsx`, `reset-password.tsx`, `_authenticated.deal.$id.tsx`, `_authenticated.tx.$id.$stage.$step.tsx`.
- `routeTree.gen.ts` regenerates itself; no manual edit.
- Verify with a typecheck and a load of `/live-deal-engine` after the change.
