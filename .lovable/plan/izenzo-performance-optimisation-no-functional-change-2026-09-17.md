# Izenzo performance optimisation (no functional change)

Objective: make the app faster to load, query and navigate before handover. No business rules, governance, RLS security behaviour, auth or workflow logic change. Nothing is deleted from migrations, and no table is dropped.

## Phase 1 — What the audit already found (measured, not guessed)

Evidence comes from the live database's query statistics, index usage, table sizes, RLS policy definitions and a code scan.

### Database findings

| Issue | Where | Why it hurts | Impact | Safe? |
|---|---|---|---|---|
| No index on `counterparties.transaction_id` — table has only its primary key | `counterparties` | The three heaviest queries in the whole system all filter on this column: 11,572 + 4,186 + 3,108 calls, ~49 seconds of total database time. Every one is a full table scan. | HIGH | Yes |
| No index on `transaction_events.transaction_id` | `transaction_events` | Every workspace timeline, audit view and Memory read scans the table. | HIGH | Yes |
| No index on `documents.transaction_id` | `documents` | Documents panel and certificate reads scan the table. | MEDIUM | Yes |
| No index on `bid_offers.transaction_id` | `bid_offers` | Offer reads scan the table. | MEDIUM | Yes |
| No index for the bid list query `org_id + created_by` ordered by `created_at` | `transactions` | 2,669 calls, 9.3s total — runs on every workspace/tab restore. | MEDIUM | Yes |
| RLS calls `can_access_tx(...)` once per row | `counterparties`, `transaction_events`, `documents`, `bid_offers`, `ai_proposals` | The check re-executes for every candidate row instead of once per query. Wrapping it as `(select can_access_tx(...))` makes Postgres evaluate it once. Identical access decision, same security. | HIGH | Yes |
| Duplicate index on `transactions.reference` (a plain one and a unique partial one) | `transactions` | Two indexes maintained on every write for the same lookup. | LOW | Review |
| Empty tables with unused indexes (support, funder, registry, facilitation, evidence packs, etc.) | many | Not touched. They are part of built functionality that simply has no rows yet. | — | Not changing |

### Application findings

| Issue | Where | Why it hurts | Impact | Safe? |
|---|---|---|---|---|
| Nine always-on polling timers (1.5s–8s) plus 60s heartbeats | `live-deal-engine`, `DealCanvas`, `StepScreen`, `FlightSearchBoard`, `recentDeals` | They keep firing when the browser tab is hidden and after the stage they watch is finished, multiplying database load per concurrent user. | HIGH | Yes |
| Nothing in the app is code-split (no lazy loading anywhere) | all routes | Admin, governance, auditor, funder, registry, support and marketing screens are downloaded by every user on first load. | HIGH | Yes |
| 94 `select("*")` reads | across server functions | Fetches every column, including large summary/JSON fields not used by the caller. | MEDIUM | Partly |
| Heaviest screen is one 2,838-line route | `_authenticated.live-deal-engine.tsx` | Large parse + re-render cost; sub-panels re-render on unrelated state changes. | MEDIUM | Yes |
| Activity log writes on nearly every interaction (2,907 inserts) | `ActivityTracker` | Each navigation is its own round trip. | LOW | Review |

## Phase 2 — Classification

**A. Safe (will implement)**
1. Add the missing indexes listed above (`counterparties`, `transaction_events`, `documents`, `bid_offers`, composite on `transactions`).
2. Wrap `can_access_tx(...)` / `current_org_id()` in `(select ...)` inside the affected RLS policies — same predicate, evaluated once per query.
3. Pause polling when the browser tab is hidden, and stop polling for stages already finished; keep every interval's live behaviour when the tab is in view.
4. Lazy-load the heavy secondary screens (admin, governance, auditor, funder, registry, facilitation, support, compliance) and the map/canvas heavy sub-panels.
5. De-duplicate identical concurrent reads (shared query keys instead of the same fetch in two panels) and run genuinely independent server reads in parallel.
6. Narrow the worst `select("*")` reads to the columns the caller uses, only where the caller is fully visible in code.
7. Memoise expensive repeated derivations in the workspace so sub-panels stop re-rendering on unrelated state.

**B. Requires review (will not do without your go-ahead)**
- Dropping the redundant `transactions.reference` index.
- Batching activity-log writes.
- Adding pagination to long history lists.
- Removing frontend dependencies that appear unused.

**C. Risky (will not do)**
- Any change to governance triggers, POI immutability, WaD gating, finality protection.
- Any RLS predicate rewrite that changes who can see what.
- Any table, column, function, trigger or migration removal.
- Changing AI/AI+ prompts, model or advisory flow.
- Changing external contracts (PayFast ITN, DIDIT webhook).

## Phase 3 — Verification

Build + TypeScript check, then confirm with fresh query plans that the new indexes are actually used, and walk the workflow in a browser session: bid registration, document read, search, choice, screening, Intent, POI seal, WaD, Execution, Finality, Memory — plus sign-in and one non-owner check that RLS still blocks another organisation's bid.

## Phase 4 — Report

You will get: changes made, files changed, indexes added, queries optimised, frontend optimisations, before/after query timings, build result, remaining opportunities, and everything deliberately left alone.

## Also outstanding

Your five handover files (types, both migration folders, `spine.ts`, `tx.ts`) — I will zip them into Files after the optimisation work, so the export reflects the final state.
