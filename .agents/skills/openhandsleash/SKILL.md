---
name: openhandsleash
description: This skill should be used at the start of every session in the simple-izenzo (Izenzo) repository, and whenever work involves the Izenzo trading platform, its Supabase database, its deploy pipeline, or its owner Georgia. It records how to work with this person and this repo without repeating known failure modes — most importantly that preview/DevTools plumbing must not be debugged, the production database must not be written to, and nothing may be called verified without having actually been looked at.
---

# Working in the Izenzo repository (openhandsleash)

This is a leash: hard rules learned from a session that wasted hours. Read it before acting.

The repository is `SmartifyConsulting/simple-izenzo`. The owner is **Georgia**. She works fast, in
short bursts, and her chat history is expensive for her to scroll — a previous session burned three
hours on infrastructure instead of her actual requests and she very nearly stopped using the tool.

The single sentence that matters: **do the work she asked for, verify it honestly, and do not touch
the plumbing.**

## Non-negotiable rules

### 1. Do not debug preview or DevTools plumbing

The Agent Canvas preview, Vite `allowedHosts`, port forwarding, and proxy shims are **not the task**.

- If the preview does not load on **one** attempt, stop and say so plainly. Do not try a second
  approach to the tooling.
- Do not create `vite.preview.config.ts`, proxy scripts, or any other shim in the repo.
- Do not spend turns on whether the browser can see the app.

This exact rabbit hole consumed the majority of a session and delivered nothing. Work without the
preview instead; the test suite is the verification mechanism.

### 2. Never write to the production database

The Supabase project is live and its credentials are in `.env`.

- **Reading is fine.** `select` queries, REST GETs with the publishable key, checking whether a
  column exists.
- **Writing is not**, without explicit permission in that same conversation. This includes probe
  accounts, `signUp` calls, `insert`, `update`, `delete`, and storage uploads.
- A previous session created real accounts in production while "just testing how signup behaves".
  That is not acceptable. Ask first.

The publishable key reaches `auth/v1/signup` and will happily create an account. Do not point it at
production to see what happens.

### 3. Never call something verified unless it was actually observed

"Tests pass" is not "the feature works". Do not conflate them.

- If the test suite passed but the feature was never looked at, say: *the tests pass; I have not
  confirmed the behaviour in a running app*.
- If reading compiled output is the only evidence, say that — it is weaker than seeing it work.
- Two false "this is done" claims made the tool feel unreliable and cost trust. A clear
  "not verified" is always better than a confident maybe.

### 4. Touch only `main`, and only what was asked

- `main` is the production branch and the only one that matters. Lovable builds from it.
- Do not create test commits on `main`. A previous session pushed a visible test marker to `main`,
  then had to revert it — leaving two net-zero commits in published history.
- Do not investigate, tidy, or delete side branches unless asked. `lovable-sync` in particular is a
  stale Lovable artifact; leave it alone.
- Do not refactor, reformat, or "improve" code outside the request. Running `prettier --write` over
  a pre-existing file reformats hundreds of unrelated lines and buries the real change.

### 5. Keep replies short

The chat history is laborious for Georgia to scroll. Lead with the answer or the blocker.

- No narration of commands as they are run.
- No restating the plan back.
- No status theatre. State the outcome, the evidence, and what is needed next.

## How to ship changes

1. **Schema first.** If a change needs new columns, apply the migration before merging the code that
   reads them — the code will break otherwise. Georgia applies migrations by hand in the Supabase SQL
   editor; provide one self-contained, idempotent script and say where to run it.
2. **Verify with the test suite**, not the preview:
   - `npx tsc --noEmit`
   - `npx vitest run` (82 tests at time of writing)
   - `npm run build`
   - `npm run lint` — compare against the baseline, do not try to reach zero
3. **Commit with a message that explains why**, not what. The diff already shows what.
4. Merge to `main` so Lovable picks it up. A feature branch is invisible to her deploy.

### Lint is not clean, and that is normal

The lint baseline is roughly **7,100 errors** (mostly `prettier/prettier` across pre-existing files).
This is not a bug to fix and not a signal that the code is broken. The only question is whether the
change made the number worse. Measure before and after:

```bash
npm run lint 2>&1 | grep -E "^✖" | tail -1
```

Also note `eslint.config.js` ignores `dist`, `.output` and `.vinxi` — if the count explodes, check
that the ignores are still present and that `.output` was not linted.

## Repo facts

- **Stack:** TanStack Start v1 (React 19, SSR + server functions), Vite, Tailwind v4, Nitro building
  for Cloudflare. Supabase for Postgres, Auth and Storage. Drizzle Kit for migrations (plain SQL, no
  ORM models).
- **Node:** 20+ (v24 present).
- **Deploy:** Cloudflare via Lovable, triggered by pushes to `main`. There is a real lag — minutes,
  not seconds — between a push and the live site changing. Do not report a deploy as broken inside
  that window; check the `x-deployment-id` response header to see whether a new build landed.
- **Migrations:** `supabase/migrations/*.sql`, applied by hand. `drizzle/migrations/*.sql` is
  historical and its signup trigger is live in the database (`handle_new_user` on `auth.users`).
- **Generated files:** never edit `src/integrations/supabase/types.ts` by hand.
- **Entry points:** `src/routes/_authenticated.live-deal-engine.tsx` is the main workspace and the
  file most requests touch. `src/components/steps/StepScreen.tsx` holds the per-step panels.
  `src/components/canvas/MapView.tsx` is the workflow map whose tile pulse is driven by
  `stepOverrides` in the live deal engine.

## The domain in one paragraph

A trade moves through a fixed spine: **Trading → Compliance (Without a Doubt) → Execution →
Finality → Memory**. Each gate is locked until the previous one is satisfied, and the spine is
enforced in the database by triggers and RLS, not only in the UI. **POI is immutable once sealed**;
WaD must complete before Execution or Finality; a decided AI+ proposal cannot be re-decided. Do not
weaken those triggers or policies. **AI+ is advisory only** — every accept or reject must remain an
attributed, timestamped, append-only human decision.

## When something is not working

Before hypothesising, check the cheapest explanation first:

1. **Has the deploy landed?** Compare `x-deployment-id`. Lovable lags.
2. **Is it actually deployed code?** Fetch the real chunk from the live site and grep it. The
   route-level `.js` files are loaders; the implementation is in a chunk named inside
   `__vite__mapDeps`. An unfound string does not mean undeployed code.
3. **Is the observed behaviour the same thing being described?** A tile adjacent to the one reported
   may be the one actually pulsing.
4. **Only then read the source.**

If a claim cannot be reproduced, say so and ask for the one piece of information that would settle
it, rather than asserting a cause.

## Delivery checklist

Before reporting a task done:

- [ ] The requested change is implemented, and nothing else was touched
- [ ] `tsc`, tests and build pass
- [ ] Lint is no worse than baseline
- [ ] Anything requiring a migration is called out, with the script
- [ ] The report distinguishes what was verified from what was not
- [ ] No production writes were made without permission
