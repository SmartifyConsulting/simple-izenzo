import {
  createFileRoute,
  Outlet,
  redirect,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { VerifyEmailDialog } from "@/components/auth/VerifyEmailDialog";
import { ActivityTracker } from "@/components/ActivityTracker";
import { useGoToShortcuts } from "@/lib/useGoToShortcuts";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/", search: { next: location.href } });
    }
    return { user: data.user };
  },
  component: RequireEmailVerified,
});

function RequireEmailVerified() {
  const { user, profile, loading, roles } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useGoToShortcuts();

  // Funder Workspace confinement (rebuild requirements section 9): a funder-only seat must never
  // reach Trade Desk, Governance, Developer Centre, Marketplace, Billing, or HQ/Admin, even by
  // direct URL entry. This is a UX-level redirect only — the real boundary enforced against a
  // funder session bypassing the UI entirely (e.g. a raw API call) is the RLS policies on
  // funder_releases/funder_release_events/funder_decisions, which scope every row to the caller's
  // own funder_org_id regardless of what route they hit.
  const isFunderOnly = !loading && roles.includes("funder") && !roles.includes("admin");
  const onFunderWorkspace = pathname.startsWith("/funder");

  useEffect(() => {
    if (isFunderOnly && !onFunderWorkspace) navigate({ to: "/funder", replace: true });
  }, [isFunderOnly, onFunderWorkspace, navigate]);

  if (isFunderOnly && !onFunderWorkspace) return null;

  const provider = (user?.app_metadata as { provider?: string } | undefined)?.provider ?? "email";
  const nativelyConfirmed = Boolean(user?.email_confirmed_at);
  const mustVerify =
    !loading &&
    !!profile &&
    provider === "email" &&
    (profile.login_count ?? 0) >= 2 &&
    !profile.email_verified_at &&
    !nativelyConfirmed;

  const needsOrg = !loading && !!profile && !profile.org_id;
  const onOrgSetup = pathname.startsWith("/account/settings");

  useEffect(() => {
    if (!mustVerify && needsOrg && !onOrgSetup) navigate({ to: "/account/settings", replace: true });
  }, [mustVerify, needsOrg, onOrgSetup, navigate]);

  if (needsOrg && !onOrgSetup && !mustVerify) return null;
  return (
    <>
      <ActivityTracker />
      <Outlet />
      <VerifyEmailDialog open={mustVerify} />
    </>
  );
}
