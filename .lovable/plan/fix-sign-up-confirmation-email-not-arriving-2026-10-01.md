# Fix: sign-up confirmation email not arriving

## What I found
- Resend is set up and switched on, sending from `no-reply@izenzo.co.za`.
- There's no record of the new Izenzo confirmation email being sent from either the preview or the live site in the last few hours. It never got as far as Resend.
- When the first email fails, the sign-up screen hides the error and still says "check your email". That's why you see no warning.
- The live site (izenzo-onthe-stepper.lovable.app) hasn't been republished since the change. If you tested there, it still uses the old built-in email, which is limited to a few per hour.

I don't know the exact cause yet, so step 1 is to find it.

## Plan
1. **Find the real cause.** Send one test confirmation to info@georgiaadams.co.za from the preview and read Resend's actual reply. Possible causes: izenzo.co.za isn't verified in Resend, the key isn't accepted, or the link couldn't be created.
2. **Stop hiding failures.** If the Izenzo email can't be sent, the sign-up screen will show a clear message, such as "We couldn't send your confirmation email — try Send again", and the reason will be written to the app's log. It won't quietly say "check your email" when nothing was sent.
3. **Fix whatever step 1 finds.** For example, use a From address on a domain Resend has verified, or correct the key under Admin → Integrations.
4. **Prevent the double email.** Only send the old built-in email if the Izenzo one fails, so new users get one clear email.
5. **Make it work in the preview.** The preview already runs the newest version and can send through Resend, so you don't need to publish to test. The confirmation link will open the same place you signed up from, so a preview sign-up stays in the preview.
6. **Check it end to end** with a fresh test sign-up on the preview. Publishing later only updates the live site.

## Technical details
- `SignUpForm.tsx`: `void sendViaResend().catch(() => undefined)` swallows errors. Await it, show the error and log it.
- `authEmail.functions.ts`: log `generateLink` errors and Resend failures (currently `return { ok: true }` hides them). Keep the "don't reveal if the account exists" reply to the user.
- `VerifyEmailDialog.tsx` / `verify-email.tsx`: same visible-error handling for the "Send confirmation link" button.
- No database or security changes. Tavily, the transaction gates and login rules stay as they are.
