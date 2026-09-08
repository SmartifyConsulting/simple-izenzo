# Make the deal canvas the main screen

The two-lane node map (Bidder left, Responder right) becomes the first and default screen after sign-in, instead of a page you navigate to.

## What changes

- Signing in lands directly on the canvas for your current deal. If you have several open deals, the most recent one opens automatically; the others are one click away from a compact deal switcher at the top of the canvas.
- The canvas fills the screen: less surrounding chrome, wider lanes, more room for the nodes and the matching beam.
- The deal switcher replaces the need to go back to a list: it shows deal name, value and current gate, and switching redraws the canvas in place.
- If you have no deals yet, the canvas shows a single inviting starting node ("Open a bid or an offer") instead of an empty box.
- The command bar keeps every other area (Inbox, Tokens, Registry, Facilitation, Support, Funder, Auditor, Admin) reachable exactly as now.

## Unchanged

- Database, workflow, gates, tokens and all business rules.
- Every existing route keeps working, so old links and permissions are unaffected.
- Roles and visibility rules, including system-admin-only Activity Log and Integrations.

## Technical notes

- Post-auth redirect targets (`src/routes/auth.tsx`, `src/routes/index.tsx`) resolve to the canvas route; `/dashboard` stays valid and renders the same canvas.
- `DealCanvas` gains an optional deal-switcher header fed by the existing transactions query; no new queries or tables.
- `AppShell` gets a wide/full-bleed variant used by the canvas routes only.
- Empty state moves inside `DealCanvas` as a starting node linking to `/transactions/new`.
