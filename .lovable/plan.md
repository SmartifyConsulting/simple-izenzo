# One menu on every screen

There is no duplicate screen. The app has three different top bars, and each screen picks one of them:

- the public pages (Home, About Izenzo, How It Works, The Intelligence Fabric, Pricing, Trades) use the named-word menu
- the Live Workspace and the other signed-in screens use a compact icon-only bar
- a handful of older content pages (Pricing, Glossary, Contact, Privacy, Terms, Status, product and solution pages) use a third, older bar

That is why the screen you are on looks different. The fix is to have one menu everywhere.

## What changes

- One single top bar is used by every screen in the app, public and signed-in alike.
- It carries the same named menu items on every screen: Home, About Izenzo, How It Works, The Intelligence Fabric, Pricing, Trades.
- The right-hand side stays as it is today when signed in: search, inbox with its unread count, token balance, light/dark switch and the profile picture menu. Signed out it shows Sign In / Sign Up.
- The current item is highlighted the same way on every screen.
- On narrow screens the named items collapse into a single menu button so nothing is cut off.
- The two other top bars are removed once nothing uses them.

## Unchanged

- Every page's own content, including the Live Workspace canvas, the workflow list and the match results.
- Footers, page widths and the black/cream themes.
- Sign-in, permissions, tokens, database and workflow behaviour.

## Technical notes

- Promote the header out of `AlphaBravoShell.tsx` into `src/components/layout/MainHeader.tsx`: the `NAV` list plus Trades, the unread-count query, `SearchButton`, inbox, token pill, `ThemeToggle`, `ProfileAvatarMenu`, and the signed-out `SignInModal` pair. Keep the `HeroSearchProvider` wrapper where the header is rendered so `useHeroSearch` still resolves.
- `AlphaBravoShell.tsx`, `AppShell.tsx` and `SiteHeader.tsx` all render `MainHeader` instead of their own markup. `AppShell` keeps its `wide` / `compactFooter` / `flat-frames` / `ink-grid` body behaviour and footer; only the header is swapped. `GovernanceShell.tsx` and `DeveloperShell` wording stay on whatever they already wrap.
- Add a `lg:hidden` dropdown of the same `NAV` entries so the mobile view keeps every destination.
- After the swap, delete `SiteHeader.tsx` if no route still imports it (currently `pricing`, `glossary`, `contact`, `privacy`, `terms`, `status`, `products.*`, `solutions.*`, `walkthrough`) — those routes move to `AlphaBravoShell` or keep `SiteHeader` as a thin re-export of `MainHeader`.
- Verify with a typecheck plus a load of `/live-deal-engine?panel=matches`, `/alpha-bravo` and `/pricing` to confirm identical menus.
