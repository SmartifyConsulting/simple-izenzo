ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_accessed_at timestamptz;

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
    SET login_count = COALESCE(login_count, 0) + 1,
        last_accessed_at = now()
    WHERE id = auth.uid()
    RETURNING login_count INTO v;
  RETURN v;
END;
$$;

REVOKE ALL ON FUNCTION public.bump_login_count() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bump_login_count() TO authenticated;