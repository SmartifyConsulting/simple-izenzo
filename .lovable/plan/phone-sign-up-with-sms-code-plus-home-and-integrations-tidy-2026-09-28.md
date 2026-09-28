# Phone sign-up with SMS code, plus home and Integrations tidy-up

## 1. Home page
- Remove the **Post a Trade** button (both the signed-in and signed-out versions). View Trades and Sign In / Sign Up stay.

## 2. Sign-up step 2 (Organisation)
- Remove the "Same as login email" tick box. The Organisation email is always its own field, typed in by the user. It is still needed because deal emails go to the company.

## 3. Integrations screen: add your own services
- New **Add service** button. It asks for a name, a website/dashboard address, a docs link, an optional top-up link, and the key fields the service needs (for example "API key" or "Sender ID").
- Services you add show up as cards just like the built-in ones. You can save credentials (encrypted, same as now), edit the details, and delete them.
- Built-in services still can't be deleted. You can only clear their saved details, as today.

## 4. Sign up and sign in with a phone number (Infobip SMS)
- **Sign up:** mobile number (with a country code picker, South Africa by default) and a password. No email is asked for. Izenzo sends a 6-digit code by SMS through Infobip. The account only opens once the code is entered. Codes expire after 10 minutes, a new one can be sent after 60 seconds, and 5 wrong tries locks the code.
- **Sign in:** phone number and password. The eye toggle and the Tab order stay the same.
- **Forgot password:** enter your phone number, get an SMS code, then set a new password.
- **Existing email users:** they keep signing in with their email. The next time they sign in, they're asked to add and confirm a phone number by SMS before they carry on. After that they can sign in with either one.
- Profiles and the admin Users list show the phone number. The rest of registration stays as it is: organisation, then identity document, then Save and Close, which opens the Live Workspace.

## Before building
- Once you approve, a secure form will ask for your Infobip API key and base URL. They're stored as protected server settings and never shown in the app.
- Your Infobip account needs an SMS sender approved for South Africa.

## Technical details
- `_public.index.tsx`: delete the Post a Trade `Link` and its `SignInModal` branch.
- `SignUpForm.tsx`: drop `orgEmailSameAsLogin` and require `orgEmail` for companies.
- Integrations: add an `integration_custom_providers` table (name, urls, field definitions JSON), admin-only RLS and GRANTs. `IntegrationsTab` merges it with the static catalog. Add create/update/delete server functions with an admin check. Credentials reuse the existing encrypted `integration_credentials`.
- Phone auth: the auth account uses a synthetic internal login (`<e164>@phone.izenzo.app`), which is never shown to anyone and never emailed. Enable auto-confirm, because the SMS code is now the verification. Add a `phone_otps` table (hashed code, expiry, attempts, service-role only) and `profiles.phone` + `phone_verified_at` (unique on phone). Server functions: `sendPhoneOtp`, `verifyPhoneOtp`, `resetPasswordWithOtp`. They call Infobip `/sms/2/text/advanced` through the connector gateway.
- Existing users: a `RequirePhoneVerified` gate in the signed-in area, alongside the current verification gate. Sign-in resolves a phone number to the synthetic login first, and an existing verified phone maps to the user's real email login.
- All email notifications to company contacts are unchanged.
