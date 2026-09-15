# Finish the PayFast payment fix

Buying tokens still shows "PayFast could not start this payment (400)" with a wall of page code. A direct test against PayFast with the saved merchant details already succeeded once the buyer's email address was included, so the remaining work is making sure the live app sends exactly that request and never shows raw page code again.

## What will change

1. **Send the buyer's email address with every payment.** PayFast refuses any payment request without one — this is the actual cause of the 400. The app will use the email on the signed-in account. If the account has no email saved, the screen says so in one line instead of attempting the payment.
2. **Always use the published web address for PayFast callbacks.** Return, cancel and payment-confirmation addresses point at reelme.co.za, which PayFast accepts, whether you are testing in the preview or on the live site.
3. **Show a plain reason instead of page code.** When PayFast refuses, the server pulls out PayFast's own one-line reason (e.g. "The email address field is required") and only that reaches the screen.
4. **Don't leave dead purchase records.** A refused attempt is marked as failed rather than sitting as pending forever.
5. **Verify end to end.** Run a real payment request with the saved credentials, confirm PayFast returns a payment reference, then confirm the PayFast payment window actually opens on the Buy Tokens screen and tokens are only added after PayFast confirms.

## Notes

- No credentials need to be pasted anywhere; the saved PayFast details under Admin → Integrations are used as-is.
- If PayFast still objects for an account-side reason (for example Onsite Payments not switched on for the merchant account), you'll be told exactly which setting to change and where, and tokens keep working through the existing route until then.

## Technical detail

- `src/lib/payfast.server.ts`: `emailAddress` mandatory on `createOnsitePayment`, `email_address` always in the signed field set, `payfastReason(text)` extracts `error-block__message` from the HTML error page with a trimmed-snippet fallback; throw `PayFast declined this payment: <reason>`.
- `src/lib/payfast.functions.ts`: `PUBLIC_ORIGIN = "https://reelme.co.za"`; buyer email from `claims.email` then `profiles.email`; `notifyUrl = ${PUBLIC_ORIGIN}/api/public/payfast/itn`; mark the `token_purchases` row `failed` when the create call throws.
- Confirm the running preview actually serves these modules (re-check the diff and force a fresh server-function build if the old response persists), then verify with Playwright on `localhost:8080/credits`.
