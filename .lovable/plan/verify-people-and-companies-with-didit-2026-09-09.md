# Verify people and companies with Didit

Add Didit as a live verification provider: ID document + selfie for people, company (KYB) checks, and sanctions/PEP screening. Verifications can be started from a person's own profile and from the Without a Doubt (WaD) compliance step on a deal.

Nothing in the existing database, gates, token costs, or business rules changes.

## What you get

1. **Didit in the Integrations screen** (system admin only, as today)
   - New provider card with API key, workflow ID(s) for each check type, environment (sandbox / production), and a webhook secret field. Secret fields keep the encrypted storage and eye toggle already used by the other providers.
   - "Test connection" makes a real read-only call to Didit so you know the keys work.

2. **Verify yourself, in Account settings**
   - A "Identity verification" card showing your current state: Not started / In progress / Verified / Needs review.
   - "Start verification" opens the Didit session (ID document + selfie) and returns you to the app. The result arrives on its own — no form filling.

3. **Verification at the WaD gate on a deal**
   - The WaD step gains three checks against the counterparty: person ID, company (KYB), sanctions/PEP.
   - Each shows Start / In progress / Pass / Review needed, with the date and a link to the stored result.
   - The existing 3-token WaD cost, the seal action, and the gate lock rules stay exactly as they are. A failed or pending Didit check does not silently pass — it routes to review, matching the current identity-routing rule.
   - Results are written as transaction events and, where a check needs a human, a compliance case, using the tables already in place.

4. **Results land automatically**
   - Didit calls the app back when a check finishes, so statuses update without anyone refreshing or re-submitting.

## Technical notes

- New table `public.identity_verifications`: subject (user, org or counterparty), transaction id (nullable), check type (id_document / kyb / aml), provider session id, status, decision, raw result JSON, timestamps. RLS: members read verifications for their own org / their own user row; writes only from the server. GRANTs issued in the same migration.
- Didit credentials read from the existing encrypted `integration_credentials` store; a `didit` entry is added to `src/lib/integrations.catalog.ts`. No new plaintext keys in code.
- Server functions in `src/lib/didit.functions.ts`: `startVerification`, `getVerificationStatus`, `listVerificationsForTx`. All authenticated; the deal-level ones check org membership before returning anything.
- Callback endpoint at `src/routes/api/public/webhooks/didit.ts`, verifying Didit's signature with the stored webhook secret before writing any row.
- `src/lib/identityRouting.ts` stays the source of truth for which country routes to Didit vs manual review; unsupported jurisdictions still go to manual review.
- UI touches: `src/routes/_authenticated.account.settings.tsx`, the `compliance/wad` branch of `src/components/steps/StepScreen.tsx`, and `IntegrationsTab.tsx`.

## After approval

I will build the above, then ask you to save the Didit keys in the secure form so we can run one live test verification end to end.
