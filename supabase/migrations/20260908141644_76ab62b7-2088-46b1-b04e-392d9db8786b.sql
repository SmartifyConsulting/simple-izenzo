CREATE OR REPLACE FUNCTION public.is_platform_superuser()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = auth.uid()
      AND lower(u.email) = 'georgia.adams@smartify.co.za'
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_platform_superuser() TO authenticated;

DROP POLICY IF EXISTS "admin insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "admin delete roles" ON public.user_roles;

CREATE POLICY "admin insert roles" ON public.user_roles
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND (role <> 'admin'::app_role OR public.is_platform_superuser())
);

CREATE POLICY "admin delete roles" ON public.user_roles
FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND (role <> 'admin'::app_role OR public.is_platform_superuser())
);