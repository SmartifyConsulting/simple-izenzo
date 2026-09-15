# Straight to the Live Workspace, tidier search bar

## What changes

1. **No bid tabs at the bottom of the hero page.** The strip of bid tabs (Search, New and each open bid) never appears on the public pages — it belongs to the workspace only. The sign-in frame on the hero page stays exactly as it is.
2. **Sign in lands on the Live Workspace.** After a successful sign in or sign up from that pop-up, the person goes straight to the Live Workspace — nothing sends them back to the home page.
3. **Every "Start a Trade" button goes to the Live Workspace.** Signed in: straight there (as now). Signed out: the sign-in pop-up opens, and the moment sign-in succeeds they land on the Live Workspace. The upload/preview card that used to open instead is no longer used by that button.
4. **"Finding counterparties…" moves inline.** It now sits on the same bar as "Running AI and AI+ search for matching counterparties…", to the right of that text, instead of on its own line above.
5. **Smaller wording on that bar.** "Running AI and AI+ search for matching counterparties…" is reduced to the smaller size used elsewhere in the workspace, and "Finding counterparties…" is set slightly smaller still as muted text.
6. **No profile picture after signing in** — investigated, then fixed. Sign-in itself succeeds (the backend records the login), so the fault is on the screen: the profile circle in the top bar isn't appearing once signed in. This will be reproduced in the browser first to see whether the profile record is loading, and then fixed so the profile circle (picture or initials) shows on every screen straight after signing in.

## Unchanged

- The workspace itself, the workflow map, bid registration, matching and screening.
- The sign-in form's own rules: forgot-password link skipped in tab order, show/hide on password fields, working forgot-password and reset-password pages.
- All home page content, including the sign-in frame in the hero and the live match card.

## Technical notes

- `src/components/canvas/WorkspaceTaskbar.tsx`: `isMarketingPath` currently lists only `/`, `/alpha-bravo` and `/auth`; invert it to an allow-list so the taskbar renders only on the workspace-side routes (Live Deal Engine and the other signed-in screens), never on any `/alpha-bravo*` page. Confirm in the browser which hero path was still showing it.
- `src/components/marketing/SubmitBidButton.tsx`: signed-out click wraps the button in `SignInModal` (`next="/live-deal-engine"`) instead of the `HeroMatchCard` dialog; signed-in behaviour (`navigate({ to: "/live-deal-engine", search: { fresh: true } })`) stays.
- `src/routes/_authenticated.live-deal-engine.tsx`: delete the standalone "Finding counterparties…" block (~line 2009) and render it inside the searching bar (~line 2095) as a right-aligned `ml-auto` `text-[11px] text-muted-foreground` span, gated on `interestCount === 0`; the headline text drops from `text-sm` to `text-xs`.
- Avatar: `MainHeader` renders `ProfileAvatarMenu` whenever `useAuth().user` is set, and `src/lib/auth.tsx` `load()` fills `profile` from `profiles`. Reproduce a sign-in in the browser and check whether `user` is set but `profile` is null (RLS on `profiles`, missing row, or `loading` never clearing) before changing anything; the avatar already falls back to initials, so a blank circle points at `user` being absent on that screen. `client.ts`/`previewAuthStorage.ts` are generated and must not be edited — any fix goes in `src/lib/auth.tsx` or the header.
- Verify with a typecheck, the build log, and a browser pass: sign in from the top bar, confirm the Live Workspace loads with the profile circle in the top bar, then refresh and confirm it is still there.
