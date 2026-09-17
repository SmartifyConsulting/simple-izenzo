# Izenzo technical handover: cleanup, optimisation and final package

The client's requested deliverables are the minimum. Nothing in the Transaction → Seal Intent/POI → WaD → Execution → Finality → Memory workflow changes.

## Already done (this session)

- Indexes added: `counterparties(transaction_id)`, `counterparties(transaction_id, shortlisted, score)`, `transaction_events(transaction_id, created_at)`, `documents(transaction_id)`, `bid_offers(transaction_id)`, `transactions(org_id, created_by, created_at)`. The heaviest query dropped from ~5 ms per call on a full table scan to 0.17 ms on an index scan.
- Access checks on those tables now evaluate once per query instead of once per row; the stored rules were confirmed identical in meaning, so nobody gains or loses access.
- Workflow map, classic stepper and the AI+ panel now load on demand; recent-bids list stops working when the tab is hidden; the shortlist poll stops once a counterparty is recorded.
- Verified: build clean, TypeScript clean, live signed-in browser session loaded the workspace, map, bid tabs and Steps view with no console errors.

## Part 1 — Lovable trace cleanup

Audit result: 26 files mention Lovable. They fall into two groups.

**Safe to remove (will do)**
- `README.md` — rewritten as a real project README for the receiving team: what Izenzo is, how to run it, environment variables, migrations, workflow overview. Removes the Lovable build/editor sections, the Lovable project link and the stale `vertical-trade-steps.lovable.app` URL.
- `AGENTS.md` — the `<!-- LOVABLE:BEGIN -->` block removed; the rest kept as engineering notes.
- `src/components/Logo.tsx` — comment referencing a `*.lovable.app` marketing URL reworded.
- Stale Lovable preview URLs in comments elsewhere, where the comment is purely descriptive.
- Add `.env.example` with variable names only, no values.

**Must stay (platform services the app actually runs on) — documented, not removed**
- `@lovable.dev/vite-tanstack-config` — the build itself. Removing it breaks `vite build`.
- `@lovable.dev/cloud-auth-js` and `src/integrations/lovable/` — Google sign-in.
- `src/integrations/supabase/*` generated files (`client.ts`, `previewAuthStorage.ts`, `client.server.ts`, `auth-middleware.ts`, `auth-attacher.ts`, `types.ts`) — database and auth access.
- `LOVABLE_API_KEY` and the AI gateway calls — all AI/AI+ document reading, matching and recommendations.
- `src/lib/lovable-error-reporting.ts` — error reporting hook wired into the root error boundary; listed as REQUIRES REVIEW rather than removed.

Honest note for the handover document: Izenzo currently runs on Lovable-hosted build tooling, auth brokering and AI gateway. Removing branding is cosmetic; moving off those services is a migration project, and it will be written up under "Known limitations" with what each dependency does and what replacing it would involve.

## Part 2 — Database cleanup

Every table in the database was cross-referenced against the application code, the database functions, triggers, RLS policies and migrations.

Result: **every one of the 64 tables is referenced by application code or by an admin/governance database function.** The empty ones (support, funder, registry, facilitation, evidence packs, API keys, forensics, archive moves, settlement mismatches, AI suggestions) are built features with no rows yet — they are classified DATABASE-DEPENDENT / ACTIVELY USED and kept.

Only one object is CONFIRMED UNUSED with hard evidence:
- `transactions_reference_idx` — a plain index on `transactions.reference` that duplicates `transactions_reference_unique_idx` (unique, partial) on the same column. The unique index serves every lookup; the plain one only costs write time. It is the single removal, in its own migration.

No tables, columns, enums, functions, triggers, foreign keys, RLS policies or storage buckets are removed. Anything I could not prove unused is reported as REQUIRES REVIEW, not deleted.

## Part 3 — Remaining safe performance work

- Narrow the worst `select("*")` reads to the columns the caller uses, only where the caller is fully visible.
- Parallelise independent server reads that currently run one after another.
- Memoise repeated derivations in the workspace so sub-panels stop re-rendering on unrelated state.

Deliberately not done (reported instead): activity-log write batching, history-list pagination, dependency removal, architecture changes.

## Part 4 — Handover documentation

Rewrite `Izenzo-Integration-Handover` (markdown + Word) so every lettered client item has its own section, A through U: generated types, transaction schema, bid/bid-offer, organisation, org member, POI, WaD, Execution, Finality, transaction events, relationships, RLS/security, governance rules, workflow/stage and locking rules, database functions and triggers, migration structure, external integrations, environment variables, deployment, known limitations, outstanding functionality. Each schema section is a real field table read from the live database, plus authority-to-act. Then the new sections: optimisations completed, cleanup performed, objects removed, objects retained and why, remaining opportunities, REQUIRES REVIEW list. No secrets anywhere.

## Part 5 — Final ZIP

`Izenzo-Codebase-Handover.zip` in Files: all source, `src/integrations/supabase/types.ts` regenerated from the final database state, both migration folders complete, `src/lib/spine.ts` and `src/lib/tx.ts`, configuration needed to build and deploy, `package.json`, README, `.env.example`, the handover document. Excluded: `node_modules`, caches, build output, `.env`, `.git`, any secret. The archive is built and its full entry list inspected before it reaches Files.

## Part 6 — Validation actually performed

Build, TypeScript, imports; index usage re-confirmed with query plans; a signed-in browser pass over the Live Workspace and the POI, WaD, Execution, Finality and Memory stage screens; sign-in; a read that proves another organisation's bid is still refused; the two callback routes exercised for correct rejection of an unsigned request. Only checks actually run get reported.

## Final report

Client request item by item with file/section locations, cleanup findings, objects removed and retained, performance results, files and migrations changed, build result, checks performed, remaining issues, ZIP location and contents, and confirmation that no secrets are included and the core workflow is functionally unchanged.
