# Fix: Hanish's Accept fails on BID9633870

## What's wrong (confirmed)
Hanish (info@seedaxis.co.za) belongs to two companies. BID9633870 is linked to one of them as the counterparty, but his profile's "active" company is the other one.

The app decides he's the counterparty by checking all his companies. The database permission check for deal access only looks at his active company on the counterparty side, though it checks all companies on the bidder side. So the app lets him press Accept, but the database refuses to save his response. That's the "row-level security" error.

## Fix
One new database migration that updates the deal-access check (`can_access_tx`) so a person counts as the counterparty if any of their companies is linked to the deal. This matches how the bidder side already works.

- No other gates change. The sealed Proof of Intent, the WaD requirement, and the rule that only the signed-in person's own response is recorded all stay the same.
- This also fixes the same hidden failure for any multi-company counterparty on their other actions (challenges, messages, documents, signatures), since they all use the same check.

## Verify
- Check that the updated function now returns access for Hanish on BID9633870.
- Ask Hanish to press Accept again.

## Technical details
New migration: `CREATE OR REPLACE FUNCTION public.can_access_tx` adding
`OR EXISTS (SELECT 1 FROM org_members m WHERE m.org_id = t.counterparty_org_id AND m.user_id = auth.uid())`, keeping the rest as it is (SECURITY DEFINER, search_path public).
