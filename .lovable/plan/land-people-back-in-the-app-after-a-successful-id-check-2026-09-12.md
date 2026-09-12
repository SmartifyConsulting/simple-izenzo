# Land people back in the app after a successful ID check

## What happened

Your check passed, but the provider was told to send you to a signed-in page. That new tab does not carry your sign-in, so the app bounced you out to the public home page — which looks like the check went nowhere.

## What to change

1. A dedicated "verification complete" page
   - The provider now returns you to a small public page that works whether or not that tab is signed in.
   - It checks the result for you and shows one of three things: "Verified — you're done", "Still being reviewed", or "Not approved", each in plain words.
   - When it passes, a single button takes you to your workspace (signing in first if that tab needs it), and the verified badge is already in place when you get there.

2. Never dump you on the public home page again
   - The return address stops pointing at a signed-in screen.
   - The original tab keeps refreshing on its own, so if you return to it the identity window closes itself once the pass lands.

3. Make sure the pass is actually recorded
   - The page asks the provider directly for the outcome, so the result is saved even if the provider's automatic notification is missing or misconfigured.
   - If the provider cannot be reached, the page says so and offers a retry rather than sitting blank.

4. Opening the check without leaving the app
   - The provider deliberately refuses to be displayed inside another site, so it can never appear embedded in your page. What it can do is open cleanly in its own window.
   - Pressing Start now opens a proper popup window sized for the check, launched directly from your click so browsers don't block it, with the app still open behind it.
   - While it is open the app shows a live "Verification in progress" state with a "Reopen window" button, so a closed or lost window is one click away.
   - When the check finishes, that window lands on the completion page above and closes itself, and the app behind it updates on its own — no copying links, no hunting for tabs.
   - The copy-link fallback stays for the rare case a browser refuses the popup, and on a phone it simply opens in a new tab instead.

## Technical notes

- New public route `src/routes/verify.complete.tsx` reading `?vid=<verification id>`; no auth required, so it renders in a fresh tab.
- New server fn in `src/lib/didit.functions.ts`: `finaliseVerificationPublic` — unauthenticated, validates `vid` as a uuid, loads the row via `supabaseAdmin`, calls `fetchDiditDecision` + `mapDiditStatus`, writes status/decision/result/completed_at, runs `notifyIfFullyMatched` on a pass, and returns only `{ status, checkType }` (no PII, no provider payload). Rate-limit-safe: it is a lookup by opaque uuid and returns nothing sensitive.
- `startVerification`: `callbackUrl` becomes `${origin}/verify/complete?vid=${row.id}` instead of `${origin}/account/settings`.
- The complete page polls that fn a few times (2s interval, ~30s cap), then shows the final state with a "Check again" button; on pass, a `Link` to `/live-deal-engine`.
- `_authenticated.tsx` already polls `identity_verifications` every 4s, so the original tab closes the dialog on its own once the row flips to `passed` — no change needed there.
- Popup launch: `VerificationPanel.onStart` keeps the click in the same task — open a blank `window.open("", "izenzo-verify", "popup,width=520,height=800")` synchronously, then set `win.location.href = res.url` once `startVerification` resolves, so no popup blocker fires. Keep a ref to the window for "Reopen window"; treat `win === null` as blocked and fall back to the existing link/copy block. On small viewports (`matchMedia("(max-width: 640px)")`) use a plain new tab.
- `src/routes/verify.complete.tsx` calls `window.close()` after a pass when `window.opener` exists, otherwise shows the "Go to your workspace" button.
- Embedding the provider in an iframe is not possible — it sends `X-Frame-Options`/frame-ancestors headers (the `ERR_BLOCKED_BY_RESPONSE` you saw), so no in-page dialog can host it.
