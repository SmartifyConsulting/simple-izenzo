# Fix: Jane Doe sees no data

## What's wrong

Jane Doe's account is not linked to any company. Almost every screen (dashboard, deals, documents, notifications, credits) shows only data belonging to the company you're part of, so with no company attached her screens come back empty — even though she has admin rights.

Separately, the activity log table does not exist in the database. Every page view and click tries to record activity and silently fails in the background.

Verified before writing this plan: Jane has no company membership and no company set on her profile; the activity log table is absent.

## What we'll do

1. Add Jane Doe to Izenzo Commodities (Pty) Ltd as a member, and set that as her active company. She'll then see the same deals, documents, credits and notifications as any other Izenzo member, plus her admin areas (Users, API Keys). Integrations and Activity Log stay system-admin only.
2. Create the missing activity log storage so page views and clicks are recorded properly and the Activity Log screen shows real entries. Access rules: a person can write their own activity; only the system admin can read it.
3. Check the same gap for any other signed-up user with no company, and report who else is affected (no silent reassignment — we'll tell you and you decide).

## Technical notes

- Data change: insert `org_members` row (user 541b5bdb…, org 11111111-0000-4000-8000-000000000001, role `member`) and set `profiles.org_id` for Jane. `current_org_id()` then resolves, unlocking the org-scoped RLS policies on transactions, documents, notifications, credit ledger.
- Migration: `public.user_activity_log` (user_id, event_type, label, path, created_at) with GRANT INSERT/SELECT to `authenticated`, GRANT ALL to `service_role`, RLS on: insert allowed when `user_id = auth.uid()`, select restricted to `public.is_platform_superuser()`.
- No UI changes required; existing `ActivityTracker` and `AuditLogTab` already target that table name.

## Also: Funder screen loses the side menu

Opening Funder from the menu drops you onto a page with no navigation, so there's no way back except the browser button. Confirmed: the Funder page builds its own bare header instead of using the standard app frame every other page uses.

Fix: wrap the Funder page in the same app frame (title "Funder Workspace", with its existing content unchanged), so the left menu, top bar and avatar stay in place and its private header/sign-out block is removed.

Technical: `src/routes/_authenticated.funder.tsx` renders a custom `Logo` + sign-out header; replace with `<AppShell title="Funder Workspace" description=...>` like `_authenticated.auditor.tsx`, including the loading/empty states.
