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

## Technical notes

- New public route `src/routes/verify.complete.tsx` reading `?vid=<verification id>`; no auth required, so it renders in a fresh tab.
- New server fn in `src/lib/didit.functions.ts`: `finaliseVerificationPublic` — unauthenticated, validates `vid` as a uuid, loads the row via `supabaseAdmin`, calls `fetchDiditDecision` + `mapDiditStatus`, writes status/decision/result/completed_at, runs `notifyIfFullyMatched` on a pass, and returns only `{ status, checkType }` (no PII, no provider payload). Rate-limit-safe: it is a lookup by opaque uuid and returns nothing sensitive.
- `startVerification`: `callbackUrl` becomes `${origin}/verify/complete?vid=${row.id}` instead of `${origin}/account/settings`.
- The complete page polls that fn a few times (2s interval, ~30s cap), then shows the final state with a "Check again" button; on pass, a `Link` to `/live-deal-engine`.
- `_authenticated.tsx` already polls `identity_verifications` every 4s, so the original tab closes the dialog on its own once the row flips to `passed` — no change needed there.
