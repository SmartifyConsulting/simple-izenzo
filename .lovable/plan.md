# Make new admin rights appear without a re-login

## What we know

Jane Doe (info@georgiaadams.co.za) does now hold the admin right in the database, alongside Georgia and two other accounts. The access rules on the roles table allow her to read her own rights, so the data side is correct.

The likely reason she still sees no Users or API Keys tabs is that her signed-in browser session loaded her rights once, before the admin right was granted, and nothing re-reads them afterwards. This is not yet confirmed from her browser, so the first step is to confirm it.

## Plan

1. Confirm the cause: check in the running app whether her session reports the admin right, and whether the roles read returns an error or an empty list.
2. If confirmed, make rights re-read automatically instead of only once per sign-in:
   - Re-read the signed-in person's rights whenever the browser tab regains focus and whenever the session token refreshes.
   - Re-read rights when the System Admin screen is opened, so a freshly granted right takes effect on the next page visit.
3. Improve the "no access" message on the System Admin screen: while rights are still loading, show a loading state rather than the "your seat does not have that role" message, and add a "Recheck my access" action.
4. Verify by signing in as Jane and confirming Users and API Keys are visible, and that Integrations and Activity Log remain hidden for her (system admin only).

## Technical notes

- `src/lib/auth.tsx`: the provider loads profile, roles, and memberships once per auth event. Add a focus listener and handle `TOKEN_REFRESHED` to re-run the loader, and expose the existing `refresh()` where needed.
- `src/routes/_authenticated.admin.tsx`: call `refresh()` on mount, and gate the "not an administrator" message behind the provider's `loading` flag.
- No database or access-rule changes required.
