# Retry the Didit checks

Your Didit settings now hold three proper workflow IDs (ID document, company/KYB, sanctions), so the checks can be run for real.

## What I'll do

1. Run a live connection check against Didit using the saved key and the ID-document workflow, and confirm it returns a verification session.
2. Repeat for the company (KYB) and sanctions/PEP workflows so all three are proven, not just the first.
3. Record the result on the Didit entry so Admin → Integrations shows a green "last tested" line with the date.
4. If any call is refused, report exactly what Didit said and what needs changing (key, workflow, or sandbox vs production) rather than guessing.
5. Check that the results Didit sends back reach the app: confirm the webhook address and signing secret line up, and that a returned result lands on the person or company record.

## Technical notes

- Sessions are created against `https://verification.didit.me/v2/session/` with the `x-api-key` header; the environment is currently sandbox.
- Test sessions use a `vendor_data` marker so they are recognisable and not confused with real verifications.
- The connection test in `src/lib/integrations.functions.ts` already probes the ID-document workflow; it will be extended to cover KYB and AML in the same run.
- No schema, gate, token-cost or permission changes.
