# Izenzo Trading Platform

Izenzo is a governed trade-workflow platform. A trade moves through a fixed
"spine" of stages, and each stage is locked until the previous one is
satisfied:

```text
Transaction (bid registration, documents, matching, counterparty choice)
  -> Seal Intent / Proof of Intent (POI)   immutable once sealed
  -> Without a Doubt (WaD)                 mandatory, non-waivable gate
  -> Execution
  -> Finality
  -> Memory (append-only history)
```

AI+ is advisory only. It proposes; an authenticated human accepts or rejects,
and that decision is recorded separately and attributed. AI+ can never select a
counterparty, seal a POI, approve WaD, or alter Execution or Finality.

## Tech stack

- TanStack Start v1 (React 19, SSR + server functions) built with Vite
- Tailwind CSS v4 (`src/styles.css`)
- Supabase (Postgres, Auth, Storage) — the "Lovable Cloud" managed instance
- Drizzle Kit for SQL migrations (plain SQL; no ORM models)

## Running locally

Requires Node.js 20+ (or Bun) and a Supabase project.

```sh
npm install
cp .env.example .env    # fill in your Supabase values
npm run dev             # http://localhost:8080
npm run build           # production build
npm run lint
```

## Environment variables

See `.env.example`. Client-visible values use the `VITE_` prefix; server-only
values must not. Secrets (service role key, AI gateway key, payment and
verification credentials) are supplied by the hosting environment and are never
committed.

## Database

Schema lives entirely in SQL migrations:

- `drizzle/migrations/0000…0015_*.sql` — tables, columns, grants, RLS policies,
  governance triggers (see `0011_decision_pack_governance.sql` for POI
  immutability and the WaD-before-execution/finality gate)
- `supabase/migrations/*.sql` — later dated additions (onboarding fields,
  avatars bucket, authority-to-act, ops alerts, organisation invite codes)
- `drizzle/schema.ts` is an intentionally empty placeholder required by
  Drizzle Kit; no schema is defined there
- `src/integrations/supabase/types.ts` is generated from the live database —
  never edit it by hand

Row Level Security is enabled on every application table. Access is derived
server-side from organisation membership through the `can_access_tx()`,
`current_org_id()` and `has_role()` database functions. Platform roles live in
`user_roles`, never on a profile.

## Key source locations

| Area | Path |
| --- | --- |
| Stage/step vocabulary and locking rules | `src/lib/spine.ts` |
| Transaction and event interfaces | `src/lib/tx.ts` |
| Live Workspace (main screen) | `src/routes/_authenticated.live-deal-engine.tsx` |
| Workflow map / classic stepper | `src/components/canvas/` |
| Per-stage screens | `src/components/steps/StepScreen.tsx` |
| Server functions (RPC) | `src/lib/*.functions.ts` |
| Server-only helpers | `src/lib/*.server.ts` |
| Inbound callbacks (PayFast ITN, DIDIT webhook) | `src/routes/api/public/` |

## Handover documentation

`Izenzo-Integration-Handover.md` / `.docx` documents the schemas, governance
rules, RLS, integrations, deployment targets and known limitations in full.
