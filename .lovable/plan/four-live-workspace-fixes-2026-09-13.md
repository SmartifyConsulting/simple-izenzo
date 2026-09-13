# Four Live Workspace fixes

## 1. Project Preparation and Execution become collapsible headings

Both grey grouping headings in Step 3 keep their small-caps look and hairline rule, but gain a
leading `−` / `+` marker and become clickable:

- `+ PROJECT PREPARATION` when collapsed, `− PROJECT PREPARATION` when open.
- Collapsing hides the rows that belong to it (Concept, Pre-feasibility, Feasibility, Bankability
  under Project Preparation; Implementation under Execution).
- Both start open, so nothing disappears unless the user collapses it.

## 2. Remove the mail icons from the counterparty results

The envelope / envelope-with-tick button on each result row is removed, along with the invite
action behind it, so each row is just the selectable organisation, its details and the match
percentage.

## 3. Duplicates in the counterparty results (e.g. Deloitte)

Duplicate collapsing currently only happens in the full "all matches" list, not in the shortlist
where the choice is made — which is why the same firm still appears several times there. The same
collapsing rule gets applied to the result rows in the workflow list: same organisation by
normalised name (punctuation and company suffixes ignored) or same website host counts once, the
highest match percentage is kept, and the pages it was found on are merged onto the surviving row.

## 4. BID INFORMATION not collapsed after Fetch Interest

Collapsing is currently only a screen state, so it reopens whenever the workspace re-renders,
switches tabs or is reloaded. It becomes a remembered per-bid state instead: once interest has been
fetched for a bid, BID INFORMATION stays collapsed for that bid until the user opens it again by
clicking the header.

## Technical notes

- `src/components/canvas/ClassicView.tsx`: `SubItem.heading` rows render a button with a `−`/`+`
  marker; a `collapsedHeadings` state (keyed by heading item key) hides following `indent` rows
  until the next heading or the end of the step.
- `src/components/canvas/DealCanvas.tsx`: drop the `Mail`/`MailCheck` invite button and
  `inviteCandidate`/`invitingId` usage from the candidate row; run the candidate list through a
  shared dedupe helper before rendering.
- Move `nameKey`/`hostKey`/`dedupe` out of `src/components/canvas/MatchResultsPanel.tsx` into a
  shared module (e.g. `src/lib/dedupeOrgs.ts`) so both lists use one rule; candidates dedupe on
  `name` plus the first evidence URL in `media_flags`.
- `src/routes/_authenticated.live-deal-engine.tsx`: persist the collapsed state as
  `sessionStorage bid-info-collapsed:${txId}`, written by `fetchInterest`/`runSearch` and read when
  the bid loads; the header toggle clears or sets it.
