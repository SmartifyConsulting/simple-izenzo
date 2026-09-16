# Bid tabs, a per-bid activity log, and no more reappearing upload box

## 1. Why that description / drop-files box appears

It is not a bug in itself: the workspace shows it whenever the bid on screen has no
files attached yet. So it turns up on a brand-new bid number — and it turns up again if
the workspace lands on a bid that never had a file saved to it. Either way it reads as
though a finished step came back.

### What changes

- The separate half-width box (description field + "Drop files here" + Next / Skip) is
  removed from the Live Workspace entirely. It never renders there again — not on a fresh
  bid, not after a refresh, not on a tab switch.
- So a new bid can still be described and have files attached, that same description
  field and drop area move **inside the Bid Registration frame** at the top, one row under
  the bidder details, shown only while the bid has no files at all. It uses the existing
  wide green Submit button instead of its own Next / Skip pair.
- The moment the first file is attached, that row disappears and the file list plus AI
  summary take over exactly as today. Later files are added from the Documents frame.
- Nothing about search, screening, intent or any later frame changes.

## 2. Every bid you created shows as a tab, labelled by BID number only

- On opening the workspace, the bottom tab strip is filled from the database with every
  bid your organisation created that hasn't been cancelled — newest on the right — instead
  of only the ones opened in this browser session. Reopening the app shows the same row of
  tabs again.
- Each tab shows the BID/OFF number only (e.g. `BID9089901`) — no deal title, no
  commodity, so the strip stays readable. The full name still shows on hover.
- The permanent empty "New" tab stays leftmost, and closing a tab behaves as it does now
  (with the cancel-or-keep prompt).

## 3. Admin Activity Log tracks every activity per BID

- The Activity Log in Admin gains a **BID** column and a bid filter, so all activity can
  be read one bid at a time as well as one person at a time.
- Every recorded workflow action is included, not just page views: registering a bid,
  attaching or deleting a document, the document read, search runs, counterparty choice,
  screening results, AI+ proposals accepted or rejected, intent confirmed, Proof of Intent
  sealed, WaD cleared or overridden, execution entry/exit, finality, token purchases,
  counter offers sent and answered, and tab close / bid cancellation.
- Each row reads who did it, what happened, which bid, and when — ordered newest first,
  and never editable or deletable.

## Technical notes

- `src/routes/_authenticated.live-deal-engine.tsx`: delete the
  `workspaceDocs.length === 0 && !submittedForThisBid` block (~line 2213) that renders
  `DocumentUploadStep` in its own column; render it inside the Bid Registration frame
  (~1967) under the same condition, full width, with a new optional `hideActions` prop on
  `DocumentUploadStep` suppressing only its Next / Skip row. Keep `key={dealTx.id}`,
  `onNext`, `onSubmitted`, `onFirstClassified`, `initialPrompt`, `initialFiles` wiring.
- `src/lib/dealWindows.tsx` + `src/components/canvas/WorkspaceTaskbar.tsx`: hydrate
  `windows` once from a `transactions` query (own org, not cancelled, `id, reference,
  title, created_at`), de-duplicated against session windows; tab label becomes the
  reference (fallback `deal_fallback_reference`) with the title moved to `title=`/tooltip.
- Activity: add `transaction_id uuid` (+ index) to `public.user_activity_log` via
  `lov_database--migration`, keep existing grants/policies. `ActivityTracker` and each
  workflow server fn that already writes `transaction_events` also write a
  `user_activity_log` row carrying `transaction_id`; the admin tab reads
  `user_activity_log` joined to `transactions.reference` for the BID column and filter,
  and merges `transaction_events` rows so pre-existing history still appears per bid.
- No change to RLS scope: the log stays admin-read-only.
