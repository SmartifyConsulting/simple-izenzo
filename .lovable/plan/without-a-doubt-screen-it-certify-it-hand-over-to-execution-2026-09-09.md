# Without a Doubt: screen it, certify it, hand over to Execution

Carry the same rhythm the Proof of Intent now has through the compliance gate and into Execution, and give the right-hand workspace a running summary of the trade.

## 1. Screen the six WaD items

The six items on the Without a Doubt list stay exactly as they are — KYC, KYB, UBO, sanctions, PEP, authority to act — but four of them get filled in for you instead of being ticked by hand:

- KYC (individuals identified) — from the ID document check
- KYB (entity verified) — from the company check plus the company register
- Sanctions screening clear — from the sanctions/PEP check
- PEP screening reviewed — from the same sanctions/PEP check

When the frame opens, screening starts automatically against the chosen counterparty, with a progress bar and a line saying how many of the checks have come back. Each item shows its own state: screening, matched (green tick), needs review, or could not run. Anything that comes back clear ticks itself; anything that does not stays open with the reason shown, and can still be ticked by hand as a recorded judgement.

UBO and Authority to act have no provider behind them, so they remain manual confirmations — that is the honest position and I would not fake a result for them.

Clearing the gate still costs 3 tokens (USD 30), still needs every item satisfied, and Refer/Block behave exactly as they do today.

## 2. A clearance certificate

Once WaD clears, a certificate is produced in the same style as the Proof of Intent one: the deal and its terms, the counterparty, each of the six checks and how it was satisfied, who cleared it, the date, and a fingerprint. It is filed against the bid alongside the other attachments, with the same preview and download buttons, and can be downloaded from the cleared panel.

## 3. The gate folds away and Execution takes over

Exactly as the Proof of Intent does now:

- The Without a Doubt accordion disappears and becomes a green ticked list of what was done — the six checks, the decision, and the certificate — added to the completed list above.
- The "Next steps" label moves down to Execution.
- The Execution accordion opens on its own and pulses, with the focus on Execution entry.

## 4. Live workspace summary

Once WaD has cleared, the right-hand panel shows a summary of the trade so far instead of an empty frame:

- The trade: reference, commodity, quantity, price, incoterms, jurisdiction, and the counterparty being traded with.
- A dated timeline of what has happened between the parties — bid/offer recorded, documents attached, counterparties surfaced, party chosen, screening completed, intent signed, Proof of Intent sealed, WaD cleared — each with its date and who did it.
- The certificates on file, with preview and download.

## Technical notes

- New `src/lib/wadScreening.functions.ts` (or an extension of `screening.functions.ts`) maps `identity_verifications` rows (`id_document`, `kyb`, `aml`) plus `registry_companies` to the six WaD check keys and returns per-check state; no new provider integrations.
- `WadStep` in `StepScreen.tsx` gains auto-run screening on mount, per-check status rows, a progress bar, and certificate generation on clear (upload to the private `documents` bucket, insert a `documents` row with `doc_type: 'certificate'`, sha256 from the WaD case fingerprint).
- `completeWad` and the `wad_cases` write stay unchanged; the certificate is written client-side after it returns, mirroring the Proof of Intent seal.
- `DealCanvas.tsx`: add `wadCleared` handling — collapsed green checklist for compliance, "Next steps" label above the Execution group, `forceOpen`/`pulse` on the Execution `GateGroup`, and the active-step pulse on Execution entry.
- The right-panel summary reads `transaction_events` (ordered by `created_at`) and `documents` for the transaction; no schema changes.

No database structure, gate rules, token costs, or permissions change.
