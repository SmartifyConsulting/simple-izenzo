# Restrict Integrations and Activity Log to the system administrator

Only georgia.adams@smartify.co.za should see these two admin areas. Ordinary administrators should not see them at all.

## What changes

- **Integrations tab** — hidden from the Platform tab strip for every administrator except the system administrator. (Its server side already refuses anyone else.)
- **Activity Log tab** — already hidden for other administrators; keep it that way and remove the remaining way in: the small "View activity log" button on each row of the Users list is still shown to ordinary administrators. It will only appear for the system administrator.
- If someone lands on the page with an Integrations or Activity Log web address directly, they are shown the first tab they are allowed to see instead.

## Technical notes

- In `src/routes/_authenticated.admin.tsx`, mark the `integrations` tab with `superuserOnly: true` so the existing `tabs.filter(...)` in `AdminPage` removes it for non-superusers; the same filter already handles the fallback when `search.tab` names a hidden tab.
- In `UsersTab`, gate the per-row activity-log icon button behind the existing `isSuperuser` flag.
- No database or server-function changes: `listIntegrations`/`saveIntegration`/`revealIntegrationSecrets`/`testIntegration` already enforce the system-admin email server-side, and activity-log rows stay protected by their existing access rules.
