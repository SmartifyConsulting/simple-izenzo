-- Schedules the refresh-provider-pricing Edge Function to run weekly, so Admin -> Integrations
-- always shows pricing text no older than a week without anyone needing to open the page first.
--
-- BEFORE running this, replace the two placeholders below:
--   <PROJECT_REF>   - your Supabase project ref (the subdomain in https://<PROJECT_REF>.supabase.co)
--   <ANON_OR_SERVICE_KEY> - a key the function call can authenticate with. The anon key is enough
--                     as long as the function was deployed with --no-verify-jwt; otherwise use the
--                     service role key. Either way, keep this migration file itself out of a public
--                     repo once the real key is in it, since it is stored in plain text in the
--                     database's migration history.
--
-- Also required once, before this job can do anything useful:
--   supabase secrets set INTEGRATION_ENCRYPTION_KEY=<same value the app itself uses>
--   supabase functions deploy refresh-provider-pricing

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.unschedule('weekly-provider-pricing-refresh')
where exists (select 1 from cron.job where jobname = 'weekly-provider-pricing-refresh');

select cron.schedule(
  'weekly-provider-pricing-refresh',
  '0 3 * * 1', -- every Monday at 03:00 UTC
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/refresh-provider-pricing',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <ANON_OR_SERVICE_KEY>',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
