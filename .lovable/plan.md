# BID9140055 test verification, map fixes, show-once congratulations

## 1. BID9140055: Pre-Screening verified on both sides (test data only)
- Both Izenzo and Holarc Health (Pty) Ltd show as **Verified** in Pre-Screening on App Registration for this deal.
- KYC and KYB checks are **not** changed. They stay as they are, and the parties run them normally.
- Before changing anything, the plan checks what each side's Pre-Screening card shows now. Only a side that isn't already Verified is updated, by marking that person's profile as verified.

## 2. Map: Pre-feasibility and Feasibility match Concept and Bankability
- The two tiles use the same font colour, size and weight as Concept and Bankability, in light and dark mode.
- Only Concept keeps its pulse when active.

## 3. Map: reverse the Step 3 arrow
- The arrow between Step 3 · Execution and Entry / Exit now points from Step 3 into Entry / Exit, instead of the other way round.

## 4. Congratulations show once per person
- Every celebration applies: offer approved, KYC and KYB passed on both sides, and all Legal Agreements signed.
- Each one shows once per person per deal, with a **Fantastic!** button. The message stays until they click it, then never appears again for that person on that deal, on any device.
- The other party still sees their own celebration once.

## Technical details
- Data (`supabase--run_sql`): update `identity_verifications` ids `f73f495e…`, `4bfe9c24…` to `status='passed', decision='approved', completed_at=now()`; insert passed `id_document` + `kyb` rows for tx `d049ed4d…`, `subject_org_id=089084d6…`, label "Holarc Health (Pty) Ltd".
- `MapView.tsx` 816–817: drop the `{ state: "open" }` override and reuse Concept's computed state without the pulse.
- `MapView.tsx` 232–235: swap the start and end points so the arrowhead lands on the Entry/Exit frame.
- Seen-once storage: new migration for table `celebrations_seen (user_id, transaction_id, kind, seen_at)` with PK (user_id, transaction_id, kind), GRANTs to authenticated/service_role, RLS limited to own rows (`auth.uid() = user_id`).
- `Confetti.tsx`: optional `onAcknowledge` renders a "Fantastic!" button and turns off auto-dismiss. Call sites in `live-deal-engine.tsx` (2330/2336), `CounterpartyWorkspaceView.tsx` (305/308) and `StepScreen.tsx` (2123) only show when there's no seen row. The seen row is written on click.

## 5. Only the current frame opens after a refresh
- When you refresh the Live Workspace, only the frame for the step you're working on opens. Every finished or later frame starts closed. You can still open any of them with its arrow.
- The first step is to reproduce it on a refreshed deal. That shows which frames open on their own, and which saved "open/closed" memory or default is opening them.

### Technical
- Reproduce with Playwright: open a deal at Proof of Intent or WaD, reload, and list the open frames.
- Derive each frame's initial open state from the transaction's current stage/step only (`tx.stage`, sealed POI, WaD complete, legal signed). Ignore stale per-tab `sessionStorage` open flags on first load (e.g. `bid-info-collapsed:*`). Apply this in `live-deal-engine.tsx`, `StepScreen.tsx` and `CounterpartyWorkspaceView.tsx`.
- Manual toggles still apply for the rest of the session.

## 6. Bidder sees the counterparty's KYC/KYB status change to "In progress"
- Likely cause: when the counterparty presses Start, its check is saved under the **bidder's** company. BID9140055's two Holarc checks are recorded that way. The bidder's screen then treats them as its own checks, not the counterparty's, so the counterparty column never updates.
- Fix: a check started by the counterparty is saved under the counterparty's company and name. Each side's own check is recognised by who started it. The bidder's screen now shows the counterparty's check as "In progress" and updates it every few seconds.
- The existing mislabelled checks on open deals are corrected to point at the right company.

### Technical
- `src/lib/didit.functions.ts` counterparty branch (≈ line 112): `subjectOrgId = tx.counterparty_org_id`, label = counterparty org name. Bidder branch: `subjectOrgId = tx.org_id`, label = bidder org name (keep `subject_counterparty_id` only for pre-claim counterparties).
- `VerificationPanel.tsx` `isMine`: match `created_by === user.id` first, then subject org.
- Data fix: for rows with `transaction_id` set, reset `subject_org_id`/`subject_label` to the creator's org when the creator belongs to the counterparty org.
- The panel already polls every 4 s while in progress on both sides; confirm with Playwright as the bidder on BID9140055 (before item 1 marks it passed).
