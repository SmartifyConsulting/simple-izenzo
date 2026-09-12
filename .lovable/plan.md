# One menu everywhere, plus fixing the 403 on creating a bid

## Part 1 — Why the bid creation fails (confirmed)

I checked the database directly. Two real problems, both left behind by the earlier project remix:

1. **No table permissions at all.** Not one table in the app's database currently grants access to signed-in users. Every single write — creating a bid or offer, saving a document, recording a step — is refused before any ownership rule is even considered. That is the 403 you hit, and it explains why a plain manual "test bid" fails too. The ownership rule on the bids table itself is correct and is not the problem.
2. **New sign-ups get no account record.** The automatic step that creates a person's account row when they sign up is missing, so the second test account (`info@georgiaadams.co.za`) has no account record and no company attached. Even once permissions are restored, that account would still be refused, because the rule requires the new bid to belong to the signer's company.

### The fix

- Restore the access grants for every table in the app database: signed-in users get read/write where the ownership rules already scope them, background jobs get full access, and anonymous visitors get read access only where a public rule already exists (for example the public responder directory).
- Restore the sign-up step that creates a person's account row, and fill in the missing record for the existing account so it has a company.
- Then create a bid end-to-end as the signed-in test account and confirm it saves, rather than declaring it fixed.

## Part 2 — One menu on every screen

There is no duplicate screen. The app has three different top bars and each screen picks one, which is why this screen's menu differs.

- One single top bar is used by every screen, public and signed-in.
- It carries the same named items everywhere: Home, About Izenzo, How It Works, The Intelligence Fabric, Pricing, Trades.
- The right-hand side keeps today's signed-in tools: search, inbox with unread count, token balance, light/dark switch, profile menu. Signed out it shows Sign In / Sign Up.
- The current page is highlighted the same way on every screen; on narrow screens the named items collapse into one menu button.
- The two other top bars are removed once nothing uses them.

Page content, footers, themes, permissions and workflow behaviour are unchanged.

## Part 3 — Landing behaviour (as tested)

- Visiting the workspace directly with no earlier search keeps showing the upload/search form.
- Arriving from the homepage with a search already typed creates the deal on arrival and lands straight on the summary panel instead of asking again.

## Technical notes

- New migration: `GRANT SELECT, INSERT, UPDATE, DELETE ... TO authenticated` and `GRANT ALL ... TO service_role` for every table in `public`; `GRANT SELECT ... TO anon` only for tables with an existing `TO anon` SELECT policy (`responder_listings`, and any other public read table). Also `GRANT USAGE ON SCHEMA public` and `GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public` to `authenticated`/`anon`/`service_role`, since the RLS helpers (`current_org_id`, `can_access_tx`, `has_role`) and the `admin_*` / `support_*` RPCs are called from the app.
- Recreate the `on_auth_user_created` trigger on `auth.users` calling the existing `public.handle_new_user()`; backfill `profiles` + `org_members` + `profiles.org_id` for `af30db32-…`. `ensureOrg` already upserts `profiles.org_id`, so it keeps working once grants exist.
- Header: promote the markup in `AlphaBravoShell.tsx` into `src/components/layout/MainHeader.tsx` (NAV + Trades, unread query, `SearchButton`, inbox, token pill, `ThemeToggle`, `ProfileAvatarMenu`, signed-out `SignInModal` pair). `AlphaBravoShell`, `AppShell` and `SiteHeader` render it; `AppShell` keeps `wide` / `compactFooter` / `ink-grid` body and footer behaviour. Keep `HeroSearchProvider` above wherever the header renders so `useHeroSearch` resolves. Add a `lg:hidden` dropdown of the same NAV entries.
- Verify: `bunx tsgo --noEmit`, then a Playwright pass that signs in, creates a bid (expect a saved row, no 403), and loads `/live-deal-engine?panel=matches`, `/alpha-bravo` and `/pricing` to compare menus.
