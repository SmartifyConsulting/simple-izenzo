# Submit button back at the bottom of the bid summary

## What changes

A full-width **Submit** button appears at the bottom of the Bid Information frame, under the summary
bullets and the attached files.

Pressing it:

1. collapses the Bid Information frame, and
2. starts the counterparty search (Search AI + AI+), so the results have the room.

When it shows:

- there is at least one attached document on the bid, and
- the search has not been asked for yet on this bid and no counterparties exist yet.

While the documents are still being read the button is visible but disabled and reads
"Reading documents…", so it is clear what is being waited on. Once the read lands it becomes
"Submit". After the search starts, the button is gone (the frame is collapsed and the results take
over).

## Technical detail

- `src/routes/_authenticated.live-deal-engine.tsx`, inside the Bid Information block (after the
  `savedAttachments` list, still within the `bidInfoOpen` fragment, ~line 2080): render a
  `Button className="w-full"` when
  `workspaceDocs.length > 0 && !searchGoByTx.has(dealTx.id) && interestCount === 0 &&
   flowStep !== "searching"`.
- `disabled={rereading || workspaceDocsPending || !(documentSummary || readError)}`; label
  `rereading || !(documentSummary || readError) ? "Reading documents…" : "Submit"`.
- `onClick={() => goToSearch(dealTx.id)}` — the existing helper already collapses Bid Information
  and flips `searchGoByTx`, which the existing auto-search effect picks up to run `fetchInterest`.
  No new search path, no change to search logic, gates or token costs.
