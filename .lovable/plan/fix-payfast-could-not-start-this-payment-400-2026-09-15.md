# Fix "PayFast could not start this payment (400)"

No, please don't paste your PayFast details into the chat — they're already saved securely under Admin → Integrations, and I can read them from there. Pasting them here would expose them in the conversation.

## What the error actually says

PayFast answered with a web page instead of a payment reference. That happens when PayFast refuses the request outright — almost always for one of these reasons:

1. Onsite Payments is not switched on for the merchant account (it's an opt-in feature on PayFast's side).
2. The environment doesn't match the credentials: sandbox needs PayFast's sandbox merchant details, live needs the live ones.
3. The return / cancel / notify web addresses point at a preview address PayFast won't accept.
4. The signature is built in a field order PayFast doesn't expect, or the passphrase saved doesn't match the one set in the PayFast dashboard.

## What I'll do

1. Read the saved PayFast entry (which environment, whether a passphrase is stored, whether the merchant ID and key are present) without revealing the values.
2. Send one test payment request from the server and capture PayFast's full reply, so the exact objection is known instead of guessed.
3. Fix what the reply points at:
   - correct the signed field order and passphrase handling if that's the objection;
   - use the app's public address for return/cancel/notify instead of the preview address;
   - keep the sandbox host for sandbox credentials and the live host for live ones.
4. Turn the raw page dump into a plain message on the Buy Tokens screen, e.g. "PayFast declined this payment — Onsite Payments may not be enabled on the account yet", instead of a wall of page code.
5. Re-run the test until PayFast returns a payment reference, then confirm the payment window opens.

## If it turns out to be account-side

If PayFast's reply says Onsite Payments isn't enabled, or the passphrase doesn't match, that has to be changed in your PayFast dashboard — I'll tell you exactly which setting and where, and tokens will keep working through the existing manual route until it's done.

## Technical notes

- `src/lib/payfast.server.ts` — `createOnsitePayment` field order, passphrase inclusion, host selection; surface PayFast's body as a short reason rather than raw HTML.
- `src/lib/payfast.functions.ts` — `startTokenPurchase` currently derives return/cancel/notify from the browser `origin`; switch to the published domain so PayFast accepts them, keeping the ITN route at `/api/public/payfast/itn`.
- `src/routes/_authenticated.credits.tsx` — map the thrown error to a readable inline message.
- No change to the token credit path: tokens are still only added by the verified ITN callback.
