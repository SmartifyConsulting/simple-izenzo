# Straight to the Live Workspace, tidier search bar

## What changes

1. **No sign-in tabs on the home page.** The "Sign in / Create account" card in the home page hero is removed. Signing in happens only through the Sign In / Sign Up buttons in the top bar.
2. **Sign in lands on the Live Workspace.** After a successful sign in or sign up from that pop-up, the person goes straight to the Live Workspace — nothing sends them back to the home page.
3. **Every "Start a Trade" button goes to the Live Workspace.** Signed in: straight there (as now). Signed out: the sign-in pop-up opens, and the moment sign-in succeeds they land on the Live Workspace. The upload/preview card that used to open instead is no longer used by that button.
4. **"Finding counterparties…" moves inline.** It now sits on the same bar as "Running AI and AI+ search for matching counterparties…", to the right of that text, instead of on its own line above.
5. **Smaller wording on that bar.** "Running AI and AI+ search for matching counterparties…" is reduced to the smaller size used elsewhere in the workspace, and "Finding counterparties…" is set slightly smaller still as muted text.
6. **No profile picture after signing in** — investigated, then fixed. Sign-in itself succeeds (the backend records the login), so the fault is on the screen: the profile circle in the top bar isn't appearing once signed in. This will be reproduced in the browser first to see whether the profile record is loading, and then fixed so the profile circle (picture or initials) shows on every screen straight after signing in.

## Unchanged

- The workspace itself, the workflow map, bid registration, matching and screening.
- The sign-in form's own rules: forgot-password link skipped in tab order, show/hide on password fields, working forgot-password and reset-password pages.
- All other home page content, including the live match card in the hero.

## Technical notes

- `src/routes/alpha-bravo.index.tsx`: drop the `{!user && <AuthTabs compact />}` hero card and its `AuthTabs` import; let the hero column span the full width.
- `src/components/marketing/SubmitBidButton.tsx`: signed-out click wraps the button in `SignInModal` (`next="/live-deal-engine"`) instead of the `HeroMatchCard` dialog; signed-in behaviour (`navigate({ to: "/live-deal-engine", search: { fresh: true } })`) stays.
- `src/routes/_authenticated.live-deal-engine.tsx`: delete the standalone "Finding counterparties…" block (~line 2009) and render it inside the searching bar (~line 2095) as a right-aligned `ml-auto` `text-[11px] text-muted-foreground` span, gated on `interestCount === 0`; the headline text drops from `text-sm` to `text-xs`.
- Session: verify with Playwright which auth storage key is written on sign-in in this sandbox and whether it persists across reload. `client.ts`/`previewAuthStorage.ts` are generated and must not be edited — if the broker is the cause, the fix goes in app code (e.g. an explicit `getSession`/`onAuthStateChange` rehydration path in `src/lib/auth.tsx`), and if it turns out to be platform-side, that gets reported rather than patched around.
- Verify with a typecheck, the build log, and a browser pass: sign in from the top bar, confirm the Live Workspace loads, refresh and confirm still signed in.
