# AI+ recommendations explain their reasoning

## What changes

Each recommendation in the AI+ Recommendations window gets a clear, labelled **Why AI+ recommends this** explanation, so the person deciding can see the reasoning before they accept or reject.

- Every recommendation shows its reasoning under a small "Why AI+ recommends this" label, in plain professional language — what in the bid, the documents or the counterparty record led to it, and what it would improve or avoid.
- Where the reasoning rests on something on file (a document, a screening result, a search finding, a price or term), that is named in the explanation and listed under "Based on".
- The percentage keeps its own one-line meaning: "AI+ puts this at 72% likely to be the right course."
- The explanation is saved with the decision in the filed record in Documents, so the audit trail shows what AI+ said, why, and what the person decided.

Currently a short rationale is produced and shown, but it is unlabelled, can be one thin line, and is easy to miss — this makes the "why" a required, visible part of every recommendation.

## Technical notes

- `src/lib/decisionPack.functions.ts`: tighten the system prompt so `rationale` must be two to four sentences that state the evidence, the reasoning and the expected effect, and so `source_references` names the specific documents, screening findings or record fields relied on. Reject a recommendation at validation if the rationale is empty (the validator already drops empty summaries; extend the same rule to rationale).
- `src/components/canvas/DecisionPackPanel.tsx`: render the rationale under a "Why AI+ recommends this" label with readable spacing, and the references under "Based on"; show the probability as a short sentence beside the percentage pill.
- The filed audit document already writes rationale and probability per recommendation; keep that and label it the same way in the file.
- No schema change; no change to how decisions are recorded or gated.
