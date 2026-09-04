import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth", search: { mode: "signin", next: location.href } });
    }
    return { user: data.user };
  },
  component: RequireEmailVerified,
});

function RequireEmailVerified() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();

  const provider = (user?.app_metadata as { provider?: string } | undefined)?.provider ?? "email";
  const mustVerify =
    !loading &&
    !!profile &&
    provider === "email" &&
    (profile.login_count ?? 0) >= 2 &&
    !profile.email_verified_at;

  useEffect(() => {
    if (mustVerify) navigate({ to: "/verify-email", replace: true });
  }, [mustVerify, navigate]);

  if (mustVerify) return null;
  return <Outlet />;
}
