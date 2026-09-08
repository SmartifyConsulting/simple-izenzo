REVOKE EXECUTE ON FUNCTION public.is_platform_superuser() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_platform_superuser() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_platform_superuser() TO authenticated;