# Fix: clicking Map does nothing and leaves you on Home

## What is actually happening

The Map screen itself is fine — opened with a valid signed-in session it renders the full diagram
(Trade Engine frame, compliance chain, execution, memory circle) with BID9088926 selected.

The problem is the sign-in check in front of it. Your saved sign-in has gone stale (the account log
shows the session refresh being refused as already used). When you click **Map**, the app asks the
backend "who is this?", gets an error, and quietly sends you back to the root address, which in turn
forwards you to Home. Nothing is shown, nothing explains it — so Map looks like it has disappeared.
Every other signed-in screen is affected in the same way; Map is simply the one you clicked.

## What to change

1. **Recover a stale sign-in instead of giving up.** Before deciding a visitor is signed out, the
   check retries once to renew the saved session. A momentarily expired session then just works,
   which is the case you are hitting now.

2. **Never bounce silently to Home.** If the session genuinely cannot be renewed, send the person to
   the sign-in screen with a short notice ("Your session expired — please sign in again") and
   remember the page they were trying to open, instead of dropping them on Home with no explanation.

3. **Return to where they were going.** After signing in, land back on the page that was blocked
   (Map, in this case), rather than the default screen.

4. **Clear the dead session properly.** When the saved session cannot be renewed, discard it so the
   next attempt starts clean rather than failing again on the same unusable token.

## How you will check it

- Signed in normally: clicking Map opens the map immediately, as it does today.
- With an expired sign-in: clicking Map shows the sign-in screen with the expiry notice, and signing
  in returns straight to the Map.
- No other screen or view is removed — the Live Workspace list view and every existing screen stay
  exactly as they are.

## Technical notes

- `src/routes/_authenticated.tsx` `beforeLoad`: on `getUser()` error/empty, call
  `supabase.auth.refreshSession()` and re-check; only on second failure `signOut({ scope: 'local' })`
  and `throw redirect({ to: "/auth", search: { next: location.href, expired: true } })`.
- `src/routes/auth.tsx`: accept an `expired` search flag and render the notice above the tabs;
  `safeNext` already returns the blocked path.
- `src/routes/index.tsx`: keep forwarding signed-out visitors to `/alpha-bravo`, but carry any
  `next` through so an old link still resolves after sign-in.
- No database, policy or server-function changes; routing and presentation only.
