# Make admins and the system admin see the same thing

Goal: Jane Doe (admin) and Georgia (system admin) get an identical experience, except that only the system admin sees **Activity Log** and **Integrations**. The system admin account stays hidden from the user list.

## What changes

1. **Every admin gets the extra areas.** Anyone with the admin role automatically gets Auditor Access, Funder and Counterparty areas, regardless of which extra seats their account happens to hold. Today Georgia holds counterparty/funder/auditor seats personally, which is why her menu differs from Jane's.
   - Add a **Funder** link to the left menu for admins (and for people with a funder seat) — it exists as a page today but has no menu entry.
   - Keep Auditor Access shown for admins (already the case).

2. **Activity Log and Integrations stay system-admin only.** No change to the current rule; both remain hidden and unreachable for ordinary admins, and the server keeps refusing integration reads/saves/tests for anyone else.

3. **Per-user activity shortcut.** The small history icon next to each user in Users stays system-admin only, since it opens the Activity Log.

4. **System admin stays hidden** from the Users list and cannot have their admin right revoked. Unchanged.

## Technical notes

- `src/components/layout/AppShell.tsx`: add a Funder nav entry gated on `roles.includes("funder") || roles.includes("admin")`, matching the existing auditor pattern.
- `src/routes/_authenticated.tsx`: `isFunderOnly` already excludes admins — no change.
- `src/routes/_authenticated.admin.tsx`: tab list unchanged (`superuserOnly` on integrations + activity-log); confirm no other superuser-only branches outside the Users history button.
- No database or role-grant changes: parity comes from admin-role checks in the UI, not from handing Jane extra seats.
- Verify with a typecheck and a signed-in check that Jane sees Users, API Keys, Registry, Facilitation, Compliance Cases, AI Suggestions, Auditors, Tokens, Payments, Funders, Support, Reporting — and not Activity Log or Integrations.
