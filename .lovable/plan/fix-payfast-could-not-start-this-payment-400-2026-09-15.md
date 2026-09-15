# Finish the PayFast payment fix

The screenshot is still coming from the old payment path. The current code only sends `email_address` when one is supplied, but the caller never supplies it. It also still sends the current preview address to PayFast and passes PayFast’s raw HTML directly into the alert.

## Changes

1. Read the signed-in buyer’s saved email when Buy Tokens starts and include it in every PayFast request. If no email is available, stop before contacting PayFast and show a clear account-email message.
2. Use `https://reelme.co.za/credits` for return and cancellation, and `https://reelme.co.za/api/public/payfast/itn` for PayFast’s confirmation callback, regardless of whether the purchase starts from preview or the live site.
3. Extract PayFast’s actual validation message from an HTML error response on the server, but never send the HTML page to the screen. The user will see a short message such as “PayFast declined this payment: an email address is required.”
4. Keep failed purchase records marked as failed rather than leaving them pending when PayFast refuses to create a payment.
5. Test the live PayFast request with the saved credentials, confirm it returns a payment reference, then verify that Buy Tokens opens the PayFast window instead of the error alert.

## Technical details

- `src/lib/payfast.functions.ts`: fetch the authenticated profile email, pass `emailAddress`, and use the fixed public callback addresses.
- `src/lib/payfast.server.ts`: require the email field and convert HTML/JSON PayFast errors into a safe one-line reason.
- `src/routes/_authenticated.credits.tsx`: retain the concise payment error message without displaying markup.
- Do not expose or re-enter any PayFast credentials; the credentials already saved under Integrations remain in use.
