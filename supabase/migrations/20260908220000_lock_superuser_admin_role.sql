-- Locks georgia.adams@smartify.co.za as a permanent admin: the role can never be
-- revoked or deleted for this account, at the database level, regardless of how
-- the request is made (UI, direct API call, another admin).

-- 1. Grant the admin role now, if not already held.
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'
FROM auth.users u
WHERE u.email = 'georgia.adams@smartify.co.za'
ON CONFLICT (user_id, role) DO NOTHING;

-- 2. Block any DELETE or UPDATE that would remove her admin role.
CREATE OR REPLACE FUNCTION public.protect_superuser_admin_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_superuser_id uuid;
BEGIN
  SELECT id INTO v_superuser_id FROM auth.users WHERE email = 'georgia.adams@smartify.co.za';

  IF OLD.user_id = v_superuser_id AND OLD.role = 'admin' THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'This account is locked as a permanent administrator and cannot have the admin role removed.';
    END IF;
    IF TG_OP = 'UPDATE' AND (NEW.role IS DISTINCT FROM 'admin' OR NEW.user_id IS DISTINCT FROM OLD.user_id) THEN
      RAISE EXCEPTION 'This account is locked as a permanent administrator and cannot have the admin role removed.';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_superuser_admin_role_trigger ON public.user_roles;
CREATE TRIGGER protect_superuser_admin_role_trigger
  BEFORE UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_superuser_admin_role();
