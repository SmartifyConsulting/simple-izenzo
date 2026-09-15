# Governance rules: what is already in the app, and what is missing

I checked each of the nine rules against the live app and database.

## Verification results

| # | Rule | Status |
|---|------|--------|
| 1 | AI+ is advisory, never the decision-maker | Partly. AI is instructed never to decide, and it only writes to its own proposal/search records — never to the deal, execution or finality records. But nothing structurally prevents it: there is no rule in the database, and no "proposal → human decision" step in the live workflow. |
| 2 | Choice triggers an AI+ proposal a human accepts or rejects | Missing. Choosing a counterparty records the choice and moves straight to Intent. No AI+ analysis runs, no proposal is produced, nothing is offered for acceptance. |
| 3 | A final AI+ advisory pass before Intent/POI | Missing. Intent confirmation and sealing run with no AI+ input. |
| 4 | POI is immutable once sealed | Partly. Sealing refuses to run twice, and the seal fingerprint is written to the audit log. But "change party" still clears the seal from the deal record, and the database itself allows a sealed deal to be re-opened. |
| 5 | WaD is a non-waivable gate before Execution | Yes for navigation: Execution, Finality and Memory are all locked until POI is sealed and WaD is complete, and WaD refuses to complete twice. Not yet enforced at the database level. |
| 6 | AI+ closes the loop at Finality, cannot change it | Missing. There is no AI+ involvement at Execution or Finality, and no rule preventing changes to a completed deal. |
| 7 | Proposals carry numeric probability (0–1), never Low/Medium/High | Missing. Proposals are free text with no structured fields, no probability, no proposal type. Match percentages exist, but that is the counterparty search, not a proposal. |
| 8 | Human acceptance is a separate, attributed, timestamped, append-only event | Partly. The old step screen records who adopted a proposal and when, and the audit log is genuinely append-only (no edit or delete is possible). The live workspace has no acceptance step at all. |
| 9 | AI+ cannot change the deal spine | Partly, by convention only. The order of the stages is enforced, but there is no enforced separation between what AI+ writes and what a person decides. |

## What I propose building

1. **A proposal record with real structure.** Each proposal gets a type (counterparty, pricing, risk, structure, timing, substitution, bundle), a numeric probability between 0 and 1, a rationale, and source references. Probability is stored and shown as a number/percentage — never as Low/Medium/High.
2. **Choice triggers AI+.** After a counterparty is chosen, AI+ runs and returns a set of proposals. The workspace shows them with Accept and Reject on each. Only after a person acts does the deal move on to Intent.
3. **A second AI+ pass before sealing.** Once Intent is confirmed, AI+ gets its last advisory word, presented the same way, before the seal button becomes available.
4. **Every acceptance and rejection is its own recorded event** — the signed-in person, the time, the proposal, the outcome — written to the append-only log so the trail reads "AI+ proposed X → Georgia accepted X → time", never "system selected X".
5. **Hard immutability rules in the database.** Once a deal's POI is sealed, the seal, its fingerprint and the confirmed intent can no longer be cleared or changed; once Finality is recorded, the deal's own record is frozen. "Change party" is then only possible before sealing, which is how the workspace already presents it.
6. **WaD enforced in the database, not only in the screen** — no execution or finality record can be written for a deal whose WaD is not complete.
7. **A read-only advisory pass at WaD change and at Finality**, recorded as advisory notes with no ability to alter either.

## Technical notes

- New columns on `ai_proposals`: `proposal_type` (enum), `probability` (numeric, 0–1 check constraint), `rationale`, `source_references` (jsonb), `stage_context`, `decided_by`, `decided_at`, `decision` (accepted/rejected), `superseded_by`. A `decision_pack_id` groups the proposals returned by one AI+ run.
- New server functions in `src/lib/decisionPack.functions.ts`: `runDecisionPack` (invoked on `choice_made`, `intent_confirmed`, `wad_updated`, `finality_recorded`) and `decideProposal` (authenticated human accept/reject, writes the proposal decision plus a `transaction_events` row with `actor_id`).
- Validation on the way in: a returned pack is rejected if any probability is outside 0–1 or any proposal type is unknown; nothing is written unvalidated.
- Triggers: `BEFORE UPDATE ON transactions` blocking changes to `poi_sealed_at`, `poi_hash`, `intent_confirmed_at` once sealed, and freezing the record once finality is recorded; `BEFORE INSERT ON execution_records`/`finality_records` requiring `wad_completed_at`.
- The route's `reopenChoice` path keeps working before sealing and surfaces a clear message after it.
- UI: a `DecisionPack` panel in the Live Workspace listing each proposal with its percentage, rationale and sources, and Accept/Reject per proposal; decided proposals stay visible with who decided and when.
