# User dates + guided API setup

## 1. Created and last accessed dates for users

- Add a `last_accessed_at` timestamp to the user profile record (created date already exists).
- Update it automatically whenever a signed-in person's session loads, at most once per session, using the existing login-count routine so there is no extra round trip.
- Show both dates in Admin → Users: a "Created" column and a "Last accessed" column, each with a readable relative date ("3 days ago") and the exact date on hover. Never accessed shows a dash.
- Allow sorting the user list by either date, newest first by default.

## 2. Setting up the API connections one at a time

Access: the Integrations view is visible only to georgia.adams@smartify.co.za (system admin). The tab is hidden for everyone else, the page refuses to open if reached directly, and the server checks the same thing before reading, saving, revealing or testing any credential — so no other administrator can reach the store.

Admin → Platform → Integrations keeps all provider cards, and gains a **Guided setup** mode that walks through providers one by one:

- A single-provider view showing: what the provider is for, exactly which values to fetch and where to find them in that provider's own portal, the sandbox/production switch, and the credential fields (each password field keeps the eye toggle).
- Per provider: **Save**, then **Test connection** where a live test exists; the step is only marked done once saving succeeds (and the test passes, when available).
- **Next**, **Back**, and **Skip for now** controls, with a progress strip showing which providers are done, skipped, or untouched.
- Suggested order, most useful first: Resend (email) → PayFast (payments) → Smile ID (KYC) → CIPC (company registry) → ComplyAdvantage (sanctions screening) → exchange rates → the rest.
- Providers without a live test show plainly why, and what to check manually instead.

I will then take you through the providers in that order in chat, one message per provider: I say exactly which values to paste, you paste them into the screen, we test, then move to the next. Tell me if you would rather start with a different provider.

## Technical notes

- Migration: add `last_accessed_at timestamptz` to `public.profiles`; extend the existing `bump_login_count` function to stamp it.
- Admin users query adds `last_accessed_at` to the selected columns.
- Guided setup is a mode inside `IntegrationsTab.tsx` reusing the existing catalog, save, reveal and test server functions — no new backend surface, no change to how secrets are encrypted.
