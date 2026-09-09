# From a clean match to a signed, paid, filed Proof of Intent

Carry the deal straight through: a full match tells you in the Inbox, choosing a party opens the Intent sign-off in the right panel, sealing takes the token payment, and the sealed certificate is filed against the bid as an attachment.

## 1. Inbox alert when a counterparty matches on everything

- When background screening (or a later result arriving) leaves a counterparty with every check passed — ID document, company, sanctions/PEP and registry — write one notification for the deal's organisation.
- Title reads like "Anker Innovations matched on all checks"; the body names the deal and its reference. Written once per counterparty, so refreshed results don't repeat it.
- The Inbox screen gains a Notifications list above the existing counterparty deals: unread ones stand out, each has an Open button that lands on the deal's Choice step so the party can be selected, and opening marks it read.
- An unread count shows on the Inbox item in the menu.

## 2. Intent sign-off after choosing the trading party

- Today, clicking Continue after screening records the chosen counterparty and moves the deal on. It will now also open the Intent panel on the right, matching the existing Intent screen: transaction, commodity, quantity, price, incoterms, jurisdiction, a tick box reading "I confirm these terms reflect our intent", and a Confirm intent button.
- The panel additionally shows who was chosen, and captures the signer's name and the moment of signing on the record.
- Nothing seals here; confirming intent simply unlocks the next stage, exactly as it does now.

## 3. Proof of Intent stage with its cost

- Once intent is confirmed, the right panel moves to Proof of Intent: the existing hard-gate wording, "Costs 1 token (USD 10) and cannot be undone", and the Seal Proof of Intent button.
- Existing gates stay untouched: intent confirmed, screening run, and enough tokens. Token cost and the atomic debit are unchanged.

## 4. Certificate filed as an artefact on the bid

- On sealing, the certificate block (deal, quantity, price, sealed timestamp, sha256 fingerprint) is generated and stored in the deal's private documents area, then recorded as a document row against that transaction, typed as the Proof of Intent certificate.
- It appears with the deal's other attachments, with the same preview and download icons, so it travels with the bid as evidence.
- The sealed panel keeps its own Download button as well.

## Technical notes

- Notification write lives server-side in `src/lib/screening.functions.ts` (and the verification-refresh path) inserting into `public.notifications` with `org_id`; a marker in `transaction_events` prevents duplicates. No schema change beyond that, and no new table.
- Inbox: extend `src/routes/_authenticated.inbox.tsx` with a notifications query and read toggle; unread badge in `AppShell`.
- Panel flow: `finalizeChoice` in `_authenticated.live-deal-engine.tsx` sets the right panel to `trading/intent`, then `trading/poi` once `intent_confirmed_at` is set — reusing `IntentStep` and `PoiStep` from `StepScreen.tsx` rather than duplicating them.
- Certificate: after `sealProofOfIntent` returns, upload the certificate text/PDF to the existing private `documents` bucket at `deals/<transaction_id>/…` and insert a `documents` row with `doc_type` `certificate` and the `sha256` from the seal. Gates, token costs, RLS and step advancement stay as they are.
