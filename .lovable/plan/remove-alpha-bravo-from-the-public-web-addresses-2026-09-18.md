# Remove "alpha-bravo" from the public web addresses

The public pages currently live at addresses like `/alpha-bravo/pricing`. They move to clean
addresses with no "alpha-bravo" anywhere. The pages themselves look and say exactly the same.

## New addresses

| Now | Becomes |
| --- | --- |
| /alpha-bravo | / (home) |
| /alpha-bravo/about | /about |
| /alpha-bravo/about/<article> | /about/<article> |
| /alpha-bravo/how-it-works | /how-it-works |
| /alpha-bravo/intelligence-fabric | /intelligence-fabric |
| /alpha-bravo/pricing | /pricing |
| /alpha-bravo/trades | /marketplace |
| /alpha-bravo/bidders | /bidders |
| /alpha-bravo/responders (+ sector/location pages) | /responders (+ same) |
| /alpha-bravo/trust-center | /trust-center |

Decisions already taken: the new pricing page takes over `/pricing` and the older leftover
pricing page is removed; the public trades showcase becomes `/marketplace` because signed-in
users' own Trades screen already uses `/trades`; the old `/alpha-bravo/...` addresses are not
kept alive.

## What else changes

- The home page keeps today's behaviour: a signed-in visitor goes straight to the Live
  Workspace; everyone else sees the public home page.
- The menu and footer links point at the new addresses. The Trades item still shows the
  visitor's own Trades once signed in.
- Nothing about the look, wording, sign-in, database, workflow rules or permissions changes.

## Checks

- Open every page above at its new address, signed out, and confirm it renders with the
  menu and footer.
- Confirm no page anywhere still links to an `/alpha-bravo` address.
- Signed in: the home address redirects to the Live Workspace and the Trades menu item goes
  to the personal Trades screen.
- Type check and build clean, then republish so the live site serves the new addresses.

## Technical notes

- Rename `src/routes/alpha-bravo.tsx` to a pathless layout `src/routes/_public.tsx`
  (`createFileRoute("/_public")`, unchanged `AlphaBravoShell` + `Outlet`), and rename each
  child to `_public.<segment>.tsx` with its `createFileRoute` string updated to
  `/_public/<segment>` — including the `about`/`about.index`/`about.$slug` and
  `responders`/`responders.index`/`responders.sector.$sector`/`responders.location.$jurisdiction`
  layout splits, which keep their current shape.
- `alpha-bravo.trades.tsx` becomes `_public.marketplace.tsx` (`/_public/marketplace`).
- Delete `src/routes/pricing.tsx` (old `SiteHeader` version) so `_public.pricing.tsx` owns
  `/pricing`.
- Delete `src/routes/index.tsx` and move its signed-in/next-param redirect into
  `_public.index.tsx`, which renders the home page for signed-out visitors so `/` resolves once.
- Update link targets in `src/components/layout/MainHeader.tsx` (NAV entries),
  `src/components/layout/AlphaBravoShell.tsx` (Trust Center), `src/components/layout/GovernanceShell.tsx`,
  and `src/components/marketing/ResponderDirectory.tsx`.
- Leave `src/lib/appSkin.ts` / `stylePreset.ts` / the `data-app` styling hooks in
  `src/styles.css` untouched — internal skin names, not addresses.
- `src/routeTree.gen.ts` regenerates itself; never edit it.
