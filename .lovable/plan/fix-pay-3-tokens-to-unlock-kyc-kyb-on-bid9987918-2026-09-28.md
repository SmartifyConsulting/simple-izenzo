# Fix "Pay 3 tokens to unlock KYC/KYB" on BID9987918

## What is happening
The payment itself works. Hanish1 G has actually been charged three times (9 tokens) between 17:44 and 17:46. Izenzo paid once. The screen never unlocks for Hanish, so he keeps clicking and gets charged again.

**Cause:** Hanish belongs to two companies. After paying, the app checks the token history to see whether his side has paid. The database only lets people see token history for the company set on their profile. BID9987918 uses his other company, Hanish1 G, so the check can't find his payment and says he hasn't paid. This is the same problem as his Accept error, this time with token history.

## Changes
1. **Token history visibility:** people can see token history for every company they belong to, not only the one on their profile. Admin access stays the same. Nobody can add entries through this change; it only affects who can view history.
2. **Double-charge guard:** the payment step checks for an earlier payment with full access before charging, so a deal can never be charged twice, whatever the viewer can see.
3. **Refund:** give Hanish1 G back the 6 tokens it was charged twice on BID9987918. The refund goes in as a new, labelled entry ("WaD duplicate charge refund"). No history is deleted.

## Technical details
- New migration: replace the `read credits` SELECT policy on `credit_ledger` with `org_id IN (select org_id from org_members where user_id = auth.uid()) OR has_role(auth.uid(),'admin')`.
- `payWad` in `src/lib/izenzo.functions.ts`: run `wadPaidBy` with `supabaseAdmin` (imported inside the handler), only after `wadPayerOrg` has confirmed the caller is a member of that company.
- Refund with a data insert: credit_ledger +6 for org `5715db27-…` on transaction `716854da-…`, and add 6 to that company's credits.
- Afterwards, check that `getWadPaid` returns paid for Hanish on BID9987918.
