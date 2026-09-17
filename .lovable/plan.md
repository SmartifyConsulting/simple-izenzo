# Close the connectivity gaps found in the audit

The audit found the handover is complete on schema, workflow and governance, but incomplete on connection detail. This plan documents what is missing and reissues the pack. No application behaviour changes; no credentials are written anywhere.

## 1. Add the five missing configuration names

They are read by the code but absent from `.env.example` and the document:

| Name | What it is for |
| --- | --- |
| Credential encryption key | Unlocks the provider credentials stored encrypted in the database. Without it, search, email, payments, identity verification and exchange rates cannot be read at all. |
| Vault password | Second gate that lets an administrator reveal a stored credential on screen. |
| Migration database URL | Direct database connection used to apply migrations. |
| Cron secret (and its previous value) | Authenticates scheduled callers. The helper exists; no scheduled job uses it today. |
| Email from-address | Sender address for outgoing notification email. |

Names only, with a one-line purpose each. No values.

## 2. Add a new "Connectivity and access transfer" section to the handover document

- Which values must be handed over securely, grouped by system, with the exact configuration name for each.
- That provider credentials live encrypted in the database, not as environment values, and that the encryption key must travel with the database or every stored credential is lost.
- The four storage buckets and which are private.
- Sign-in: redirect and site URLs must be updated for each domain; the current Google sign-in goes through a hosted broker, and what replacing it involves.
- CORS: none configured; server functions and callbacks are same-origin.
- DNS: the two custom domains, and the separate sender-domain records the email provider needs.
- Scheduled jobs: none exist. Separate backend functions: none — all server logic ships inside the application.
- Runtime target for the server bundle, and that the build produces both halves.
- Current environment of each integration (identity verification and payments are on sandbox today; the rest are live keys).
- A short "day one" checklist for the receiving team, in order.

## 3. Flag the one hygiene item

Record in the known-limitations section that one integration's stored configuration holds a provider key inside a URL field, so it is visible to anyone with database access, and that it should be moved into the encrypted credential store and rotated. No change is made to the data.

## 4. Reissue the pack

- Rebuild the Word document with the added sections, same Montserrat black-and-white styling, as `Izenzo-Integration-Handover-v4.docx`.
- Rebuild the ZIP as `Izenzo-Codebase-Handover-v2.zip` so it carries the updated `.env.example` and handover copy. Same exclusions; contents inspected and secret-scanned again before delivery.
- Every page of the document checked as an image before delivery.

## Technical notes

- `.env.example` gains `INTEGRATION_ENCRYPTION_KEY`, `INTEGRATIONS_VAULT_PASSWORD`, `LOVABLE_DB_MIGRATION_URL`, `LOVABLE_CRON_SECRET`, `LOVABLE_CRON_SECRET_PREVIOUS`, `RESEND_FROM_ADDRESS` — names only, empty values.
- Document edits are confined to `/mnt/documents/Izenzo-Integration-Handover.md` plus the new sections; the pandoc + Montserrat pipeline in `/tmp/docxbuild` is reused unchanged.
- No source file changes other than `.env.example`. No migrations, no database writes, no key rotation.
