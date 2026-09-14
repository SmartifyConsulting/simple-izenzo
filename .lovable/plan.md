# Why the Search Prompt frame keeps coming back on BID9089119

## What is actually happening

There are **two different bids both numbered BID9089119**:

| Recorded | Documents | Where it is |
| --- | --- | --- |
| 13 Sep 17:06 | 1 document attached | Search step (the one you filled in) |
| 13 Sep 17:43 | none | Documents step (empty) |

The workspace is opening the **second, empty one**. It has no document and no search prompt, so the
Search Prompt / upload frame is correctly asking for them — it only looks wrong because the bid
number on screen is the same as the bid you already completed.

The cause is the bid number itself. A new bid picks a number at random out of a range of only one
thousand, and nothing checks whether that number is already taken. With the number of bids on file,
a repeat was a matter of time — and once two bids share a number, the two are indistinguishable on
screen and the workspace can land you on either.

## What to change

1. **Bid and offer numbers become unique.** Before a new bid is recorded, the number is checked
   against the numbers already in use and a fresh one is drawn if it clashes, retrying until a free
   one is found. The range is widened so clashes are rare in the first place, and the database itself
   refuses a duplicate as a final safety net, so two bids can never share a number again.

2. **The existing clash is repaired.** The empty 17:43 bid keeps the workflow it is on but is
   renumbered to a free number, so BID9089119 refers only to the bid that actually holds your
   document and prompt. Nothing is deleted and no documents move.

3. **Nothing else about the frame changes.** The rule stays as it is: the Search Prompt and upload
   frame shows only while a bid has no documents and has not been submitted, and disappears the
   moment it does.

## How you will check it

- Opening BID9089119 shows the completed bid, with its attachment and summary and no upload frame.
- The renumbered empty bid appears under its own new number, still at Submission of Documents.
- Registering several new bids in a row produces distinct numbers every time.

## Technical notes

- `src/components/canvas/DealCanvas.tsx` — `nextReference` currently returns
  `base + Math.floor(Math.random() * 1000)` with no collision check. Widen the numeric span and add
  an async claim helper used by `createDeal`: query `transactions.reference` for the candidate,
  redraw on hit (bounded retries), and retry once on a `23505` unique-violation from the insert.
- Migration: add a unique index on `public.transactions (reference)` (partial, `where reference is
  not null`) after renumbering the duplicate row; the existing non-unique
  `transactions_reference_idx` can be dropped in the same migration.
- One-off data fix: update `180a3dd9-8adb-4a95-8f04-27bb2ec6794e` to a free reference.
- No change to the frame's gating logic in `_authenticated.live-deal-engine.tsx` (`submittedForThisBid`
  / `workspaceDocs`) — it is behaving correctly.
