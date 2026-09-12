# Fix the Integrations error message

The Integrations page shows "Missing Supabase environment variable(s): SUPABASE_SERVICE_ROLE_KEY". The value now exists in the environment, but the running app was started before it was available, so it never picked it up.

## What I'll do

1. Re-bind the backend connection settings for this project so the key is registered again.
2. Restart the running app so it reads the refreshed settings.
3. Reload Admin → Integrations and confirm the list of services loads instead of the red error.
4. If the error returns, report exactly what the app says rather than guessing.

## Notes

No changes to the database, the integrations catalogue, or any saved credentials. Saved keys (Resend, Bright Data, Open Exchange Rates) stay as they are.
