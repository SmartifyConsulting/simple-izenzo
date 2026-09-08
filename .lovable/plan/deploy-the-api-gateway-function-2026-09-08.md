# Deploy the api-gateway function

Publish the existing `api-gateway` function (already written at `supabase/functions/api-gateway/index.ts`) to the project's backend, unchanged.

## Steps

1. Deploy the function under the name `api-gateway`, with no code edits.
2. Confirm the JWT gate stays off so the function's own bearer tokens (`sandbox_...` / `production_...`) are accepted. Lovable-managed functions already deploy with JWT verification disabled by default; if a per-function setting is needed, add only that override in `supabase/config.toml`.
3. Verify the deployed function can read its two runtime values (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) by making a test call and reading the function logs — these are injected automatically, so this is a confirmation step, not a change.
4. Report the live URL back in chat.

## Notes

- No application code, database, or UI changes.
- If the test call shows a missing runtime value, I'll report exactly what's missing rather than editing the function.
