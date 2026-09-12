-- 1. Data API grants for every public table (stripped during the project remix).
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t.tablename);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t.tablename);
  END LOOP;

  -- anon reads only where an existing policy already targets anon.
  FOR t IN
    SELECT DISTINCT tablename FROM pg_policies
    WHERE schemaname = 'public' AND cmd IN ('SELECT','ALL')
      AND ('anon' = ANY(roles) OR 'public' = ANY(roles))
  LOOP
    EXECUTE format('GRANT SELECT ON public.%I TO anon', t.tablename);
  END LOOP;
END $$;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;

-- 2. Restore the sign-up trigger that creates a person's profile row.
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
