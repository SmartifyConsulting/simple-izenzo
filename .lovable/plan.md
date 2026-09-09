# Retire the "Dashboard" name — one main screen: Live Deal Engine

The page you are on stays exactly as it is. What goes away is the "Dashboard" naming and the idea that it is one page among several. It becomes the app's single main screen, called **Live Deal Engine**.

## What changes

- The screen's address becomes `/live-deal-engine` instead of `/dashboard`.
- Everywhere the word "Dashboard" appears — menu entry, page title, logo link, browser tab title, back links from a deal or a step — it reads "Live Deal Engine" and points at the new address.
- Signing in, signing up, verifying an email and resetting a password all land on the Live Deal Engine.
- The old `/dashboard` address keeps working: anyone arriving on it is sent straight to the Live Deal Engine, so existing links and bookmarks don't break.

## Unchanged

- The page content itself: the two-lane bidder/responder canvas, document upload, counterparty search, everything currently on screen.
- Database, workflow, gates, tokens, roles and permissions.
- Every other area (Inbox, Search Party, Registry, Funder, Auditor, Admin, Developer, Governance) stays where it is.

## Technical notes

- Rename `src/routes/_authenticated.dashboard.tsx` to `src/routes/_authenticated.live-deal-engine.tsx` and update its `createFileRoute` string plus `head()` metadata.
- Add `src/routes/_authenticated.dashboard.tsx` as a thin `beforeLoad` redirect to `/live-deal-engine`.
- Update the `/dashboard` references in `src/lib/useModules.ts` (label "Live Deal Engine"), `AppShell.tsx`, `SiteHeader.tsx`, `GovernanceShell.tsx`, `DeveloperShell.tsx`, `SignInForm.tsx`, `SignUpForm.tsx`, `auth.tsx`, `index.tsx`, `verify-email.tsx`, `reset-password.tsx`, `_authenticated.deal.$id.tsx`, `_authenticated.tx.$id.$stage.$step.tsx`.
- `routeTree.gen.ts` regenerates itself; no manual edit.
