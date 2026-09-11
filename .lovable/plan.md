# Bring the Zenzo UI Clone database into this app

## What I found

I can reach the other project ("Zenzo UI Clone") and read its full setup, including every table definition and the sample rows it ships with. What I cannot reach is its live database contents — that lives behind its own backend and can only travel by an export file.

So this brings across **structure plus the built-in sample rows**, not the day-to-day records people entered in that app. If you want those too, export that project (Cloud → Advanced settings → Export data) and attach the file; I'll load the rows on top afterwards without disturbing anything.

## What comes across

The other project has 61 tables. 51 of them do not exist here and will be added exactly as they are, with their relationships, indexes, access rules and their sample rows — for example:

- Deal spine: spine_transactions, intents, pois, wads, executions, milestones, choices, decision_sessions, memory_events, gate_events
- Matching and research: trade_matches, search_runs, counterparty_sets, social_news_items, ai_analyses, ai_suggested_matches, ai_dnc_rules
- Admin & governance: governance_cases, disputes, legal_holds, idv_reviews, legal_entities, kyc_documents, engagement_notes, platform_settings
- Funder desk: funder_organisations, funder_onboarding_requests, deal_releases, funder_audit_log
- Registry & API: registry_api_clients, registry_api_usage_events, bank_verifications, org_api_clients, api_plans, api_support_tickets, api_sandbox_scenarios, go_live_verifications
- Support pieces: certificates, evidence details, payment_sessions, token_entries, workspaces, pricing_plans, status_services, status_incidents, webhook_events, audit_logs, notification_preferences, rating_appeals, tenant_boundary_runs, legacy_repair_flags, other_documents, facilitation email/do-not-contact rules

## Where the two overlap

Ten tables exist in both, under the same name but with different shapes: organisations, counterparties, user_roles, bid_offers, compliance_cases, facilitation_cases, finality_records, evidence_packs, registry_claims, registry_companies.

For these, nothing here is dropped or rewritten. Any column the old project has and this one lacks is added as optional, and existing rows keep their values. No sample rows are loaded into these tables, so your current data stays exactly as it is.

## Steps

1. Create the missing enum types the old tables rely on.
2. Add the 51 old-only tables in dependency order, each with access rules matching the pattern already used here.
3. Add missing columns to the ten shared tables (additive only).
4. Load the old project's sample rows into the new tables only, safe to re-run.
5. Report a table-by-table count and confirm the existing screens still open.

## Technical notes

- Source: read-only snapshot of project dc767f7e (Zenzo UI Clone), `supabase/migrations/*.sql`, 20 files.
- Migrations are replayed here rather than copied verbatim: `CREATE TABLE` statements for shared names are converted into `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, and every new public table gets GRANTs to `authenticated`/`service_role` (plus `anon` only where a policy allows it) before `ENABLE ROW LEVEL SECURITY` and its policies.
- Old policies referencing helper functions that don't exist here (e.g. their own admin check) are rewritten onto this project's `has_role`/`is_platform_superuser`/`can_access_tx` equivalents.
- Seed `INSERT`s are rewritten with `ON CONFLICT (id) DO NOTHING`.
- Nothing in `auth`, `storage` or `realtime` is touched, and no existing table, column, policy or row is dropped.
- No frontend screens from the other project are copied; this is data structure only unless you ask for the UI too.
