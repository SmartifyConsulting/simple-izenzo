# AI+ Recommendations as a click-to-open modal, filed as a document

## What changes in the workspace

1. After a counterparty is chosen, the workspace no longer shows an open AI+ panel. It shows a single control: **AI+ Recommendations**, with a small count of how many recommendations are waiting.
2. Clicking it opens a large modal window. Each recommendation shows its type, its percentage, the reasoning and any sources, with **Accept** and **Reject** on each one (plus **Accept all**).
3. Once every recommendation has been answered, the modal closes itself and the decisions are saved as a file in the **Documents** panel — one record listing each recommendation, the person who decided, accept or reject, and the time. It is filed quietly; nothing pops up.
4. The AI+ Recommendations control then disappears for that bid, replaced by a small "AI+ recommendations recorded" line linking to the filed record. The person carries on with their own selection.
5. No further AI+ recommendations appear anywhere later in the deal — the closing AI+ panel at Finality is removed.

Behaviour that stays exactly as it is: AI+ only advises, it never selects, changes or seals anything; every accept/reject is recorded against the signed-in person's name and cannot be changed afterwards; percentages stay numeric.

## New documents keep AI+ up to date

When further documents are uploaded to a bid, AI+ must not carry on from an out-of-date picture. After the new files are read, AI+ refreshes its memory of the bid — the document summaries plus the recommendations already accepted or rejected — so any later decision it is asked about is based on everything on file. This does not reopen a pack the person has already answered; it only means the next time advice is needed, it reflects the new documents.

## Multi-tenant check

Verified against the live database — recommendations and filed documents are already tenant-scoped, so no changes are needed:

- Recommendations (`ai_proposals`): read, insert and update all require `can_access_tx(transaction_id)`, so one company cannot see or answer another company's recommendations.
- Documents: same rule on read, insert, update and delete.
- Deals (`transactions`): visible only to the owning organisation, the counterparty organisation, or an admin; new deals must be created under the caller's own organisation.
- Every AI+ call runs through the signed-in session (authenticated middleware), never a privileged key, so the database rules apply as that person.

The plan will re-run the standard security check after the change to confirm nothing regressed.

## Technical notes

- `src/components/canvas/DecisionPackPanel.tsx`: change from an inline accordion to a trigger button plus a `Dialog`. The pack still loads through `runDecisionPack`; each decision still goes through `decideProposal`. Keep `onAllDecided` so the existing gating in the workspace is unaffected.
- New server function in `src/lib/decisionPack.functions.ts`: `fileDecisionPackRecord({ transactionId, stageContext })` — reads the decided proposals for that transaction with the caller's session, writes a plain-text record to the `documents` storage bucket at `deals/<id>/<ts>-ai-plus-recommendations.txt`, inserts a `documents` row (`doc_type: "certificate"`, notes "AI+ recommendations"), and appends a `transaction_events` note. Idempotent: if a record document already exists for that pack it is not written twice. Mirrors the existing WaD certificate pattern in `src/lib/izenzo.functions.ts`.
- `src/routes/_authenticated.live-deal-engine.tsx`: keep the `choice_made` panel (now the button/modal) and remove the `finality_recorded` `DecisionPackPanel` render.
- AI+ memory refresh: the pack prompt built in `runDecisionPack` already reads the transaction; extend the brief it sends to include the current document summaries and the person's prior accept/reject decisions for that bid. After a new upload is read (the existing read/summarise path in `src/lib/docSummary.functions.ts` / `izenzo.functions.ts`), mark the bid's advisory context as stale so the next pack for a later stage is generated fresh rather than returned from the earlier cached pack. Already-decided packs stay untouched and are never re-asked.
- No schema change required; no new tables or columns.
