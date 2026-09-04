ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS login_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;

CREATE OR REPLACE FUNCTION public.bump_login_count()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v integer;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  UPDATE public.profiles
    SET login_count = COALESCE(login_count, 0) + 1
    WHERE id = auth.uid()
    RETURNING login_count INTO v;
  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_email_verified()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  UPDATE public.profiles
    SET email_verified_at = COALESCE(email_verified_at, now())
    WHERE id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_email_verified_if_oauth()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  IF COALESCE(auth.jwt() -> 'app_metadata' ->> 'provider', 'email') <> 'email' THEN
    UPDATE public.profiles
      SET email_verified_at = COALESCE(email_verified_at, now())
      WHERE id = auth.uid();
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.bump_login_count() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mark_email_verified() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mark_email_verified_if_oauth() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bump_login_count() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_email_verified() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_email_verified_if_oauth() TO authenticated;