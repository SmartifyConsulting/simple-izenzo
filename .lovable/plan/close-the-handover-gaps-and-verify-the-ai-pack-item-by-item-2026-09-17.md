# Close the handover gaps, and verify the AI+ pack item by item

Two parts: document the connection detail the audit found missing, and record which requirements of the uploaded AI+ integration pack are actually built. No application behaviour changes; no credentials written anywhere.

## Part 1 — AI+ pack verification (checked against the live code and database)

**Built and working**
- The five spine moments exist as advisory contexts, with the human decision recorded separately, attributed and timestamped, append-only.
- Numeric probability is kept as a number and never converted to low/medium/high.
- AI+ cannot write Choice, Intent, POI, WaD, Execution or Finality — enforced by database triggers, not just the screens.
- POI stays immutable after sealing; WaD cannot be bypassed; a decided proposal cannot be re-decided.
- One tenant cannot read or write another's proposals; every call runs as the signed-in person.
- All AI calls are server-side only; no key reaches the browser.
- Proposals are stored, and accepted/rejected outcomes are filed as a record in the Documents panel.
- The type slice the pack asks for is available and already delivered.

**Not built yet**
- The adapter to Georgia's protected AI+ service. Today AI+ runs against the hosted model service, not her private endpoint.
- The signed request client (private address, signing key, signing secret). The admin screen has the three fields; nothing calls the endpoint.
- Invocation, correlation and idempotency identifiers. The table for them exists and is empty; nothing writes to it, so retry-safety cannot be demonstrated.
- The "AI+ invoked" and failure events with the correlation identifier.
- Request mapping to her Appendix A shape, and response validation against her Appendix B shape. Note: Appendix B in the PDF she sent is blank, so the response contract cannot be implemented as delivered.
- The fifth moment, after POI is sealed, as an informational-only invocation.
- Timeout and safe-failure handling on her interface.
- The automated contract, replay, idempotency, tenant-isolation and negative tests. There is no test suite in the project at all.
- The three AI+ configuration names are missing from the example configuration file.

This becomes a section in the handover document plus a one-page status sheet, so the receiving team and Georgia both see exactly where the boundary sits. No code is written for it in this plan.

## Part 2 — Connectivity gaps from the audit

Add the five configuration names the code reads but nothing documents: credential encryption key, vault password, migration database URL, cron secret (and its previous value), email from-address. Names only, one line of purpose each, plus the three AI+ names above.

Add a "Connectivity and access transfer" section covering:
- What must be handed over securely, grouped by system, with the exact configuration name for each.
- That provider credentials live encrypted inside the database — without the encryption key every stored credential is unreadable.
- The four storage buckets and which are private.
- Sign-in: redirect and site URLs per domain, and what replacing the hosted Google sign-in involves.
- CORS: none configured; server functions and callbacks are same-origin.
- DNS: the two custom domains, and the separate sender records the email provider needs.
- No scheduled jobs and no separate backend functions exist; all server logic ships inside the application.
- The runtime target for the server half of the build.
- Which integrations are on sandbox today (payments, identity verification) and which are live.
- A short day-one checklist in order.

Record as a known limitation that one integration's stored configuration holds a provider key inside a URL field, readable by anyone with database access, and should be moved into the encrypted store and rotated. No data is changed.

## Part 3 — Reissue

- Word document rebuilt with the new sections, same Montserrat black-and-white styling, as `Izenzo-Integration-Handover-v4.docx`.
- Separate one-page `Izenzo-AIPlus-Build-Status.docx` matching her pack's deliverables and acceptance list, marked built / not built / blocked on her side.
- ZIP rebuilt as `Izenzo-Codebase-Handover-v2.zip` carrying the updated example configuration and handover copy; contents inspected and secret-scanned again.
- Every page of both documents checked as an image before delivery.

## Technical notes

- `.env.example` gains `INTEGRATION_ENCRYPTION_KEY`, `INTEGRATIONS_VAULT_PASSWORD`, `LOVABLE_DB_MIGRATION_URL`, `LOVABLE_CRON_SECRET`, `LOVABLE_CRON_SECRET_PREVIOUS`, `RESEND_FROM_ADDRESS`, `AI_PLUS_PRIVATE_URL`, `AI_PLUS_HMAC_KEY_ID`, `AI_PLUS_HMAC_SECRET` — names only, empty values. This is the only source file touched.
- Verification evidence already gathered: `ai_plus_invocations` has 0 rows and no writer in `src`; no HMAC signing outside the identity webhook; `STAGE_CONTEXTS` in `src/lib/decisionPack.functions.ts` lists four contexts, not five; `ai_proposals` holds 258 rows; `api_keys` holds 0 rows; governance triggers and RLS confirmed in the database.
- The pack's instruction to place the client in a Deno edge function does not match this stack; the equivalent here is a server-only module invoked from the trusted server path. Flag it, do not build it.
- Reuse the pandoc + Montserrat pipeline in `/tmp/docxbuild`. No migrations, no database writes, no key rotation.
- Add the AI+ adapter items to `roadmap.md` as open tasks when this is built out.
