---
name: normaliseauth
description: Izenzo sign-up procedure — 3-step wizard (details, company/individual, registration docs) that must not be bounced mid-wizard, with Authority to Act for companies and Proof of Residential Address for individuals, awarding the Verified badge.
---

# normaliseauth

## Sign-up wizard
1. Step 1 — name, email, password (eye toggle on every password field).
2. Step 2 — choose Company or Individual; company collects organisation name + registration number.
3. Step 3 — compulsory registration details:
   - ID / passport number (typed, never scanned).
   - Company: Authority to Act document.
   - Individual: Proof of Residential Address (less than 3 months old) — one of:
     - Municipal utility bill (water and electricity)
     - Recent retail or bank statement
     - Current signed lease agreement
     - Official cellular or landline telephone account

## Never bounce mid-wizard
- Call `beginRegistration()` before `signUp`; call `endRegistration()` on failure or after step 3 saves.
- Every screen that redirects or hides the form for a signed-in user (home page hero, /auth) must stand down while `registrationInProgress()` is true. Never render the sign-up form under a bare `!user` condition.

## Verified badge
- Saving step 3 sets `id_number`, the document path, `onboarding_required = false` and `identity_verified` (from the document check), then navigates into the app.
- Google sign-ups skip step 3 in the form; the authenticated layout shows a blocking registration dialog until both items are on file.

## Email verification
- Email-provider accounts without `email_verified_at` see the blocking verify-email dialog; link-based via `/verify-email?verified=1`, never codes. OAuth users are exempt.

## Auth UX
- Forgot password link uses `tabIndex={-1}`; tab order Email → Password → Submit.
- Forgot + reset-password pages always present.
