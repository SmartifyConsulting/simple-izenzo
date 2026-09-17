# Finish the handover documents and tidy the Files folder

The AI+ connection is already built, switched off by default, and all 18 automated checks pass. What remains is paperwork: refresh the two documents, rebuild the code package, and clear out the older drafts so only three files remain.

## 1. Rebuild the AI+ status sheet

Regenerate the status sheet from the prepared text so it reflects the finished adapter: signed requests, strict reply checking, invocation/correlation/idempotency logging, safe fallback when the service is slow or unreachable, and the 18 passing checks. Same look as the existing documents (Montserrat, black and white, Letter pages, one-inch margins, centred page numbers).

Output: `Izenzo-AIPlus-Build-Status-v2.docx`

## 2. Update the handover document

Add a short "Switching AI+ on" section covering:

- The three values entered under Admin → Integrations → Izenzo AI+ (private endpoint address, signing key ID, shared signing secret), stored encrypted — never in the code or in the package.
- Sandbox versus production endpoints.
- The six request headers the adapter sends, including the replay-protection key formed from the deal and the moment it was raised.
- That AI+ stays advisory: it can never select a counterparty, alter a sealed record, or block a deal.

Output: `Izenzo-Integration-Handover-v5.docx`

## 3. Rebuild the code package

Repackage the clean source with the new adapter files and the updated example environment file (which lists the new variable names without any values).

Output: `Izenzo-Codebase-Handover-v3.zip`

## 4. Tidy the Files folder down to three

Delete the nine superseded drafts, leaving exactly:

- `Izenzo-Integration-Handover-v5.docx`
- `Izenzo-AIPlus-Build-Status-v2.docx`
- `Izenzo-Codebase-Handover-v3.zip`

## Checks before handing back

Every page of both documents is converted to an image and inspected for clipped text, broken tables and missing fonts. The package contents are listed and checked to confirm no secrets, no build output and no dependency folders. No application code, database rules, governance protections or security settings change in this work.

## Still outstanding on your side

- One stored exchange-rate setting holds a key inside a web-address field; it should be re-entered properly and the key rotated.
- Georgia's AI+ service has not yet been confirmed as live and reachable, so the connection stays switched off until the three values are entered.
