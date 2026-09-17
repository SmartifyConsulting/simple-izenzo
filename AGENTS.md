# Engineering notes

- The transaction spine is protected in the database, not only in the UI:
  POI is immutable once sealed, WaD must be complete before Execution or
  Finality, and decided AI+ proposals cannot be re-decided. Do not weaken
  these triggers or the RLS policies that back them.
- Schema changes go in a new SQL migration; never edit an existing migration
  or `src/integrations/supabase/types.ts` by hand (it is generated).
- AI+ is advisory only. Every accept/reject must stay an attributed,
  timestamped, append-only human decision.
- Avoid rewriting published git history (force pushing, or rebasing,
  amending or squashing commits that are already pushed).
