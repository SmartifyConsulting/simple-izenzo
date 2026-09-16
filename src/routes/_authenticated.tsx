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
import { RegistrationDetailsDialog } from "@/components/verification/RegistrationDetailsDialog";
import { ActivityTracker } from "@/components/ActivityTracker";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const first = await supabase.auth.getUser();
    if (!first.error && first.data.user) return { user: first.data.user };

    // A saved sign-in that has simply gone stale is worth one renewal attempt — otherwise a
    // momentarily expired token quietly bounced people off the screen they clicked.
    const refreshed = await supabase.auth.refreshSession();
    if (!refreshed.error && refreshed.data.user) return { user: refreshed.data.user };

    // Genuinely signed out: discard the unusable token so the next attempt starts clean, and say
    // so on the sign-in screen instead of dropping the person on the home page with no reason.
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      /* the session is already gone — nothing to clear */
    }
    throw redirect({ to: "/auth", search: { next: location.href, expired: true } });
  },
  component: RequireEmailVerified,
});

function RequireEmailVerified() {
  const { user, profile, loading, roles } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

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

  // Registration is done once both compulsory items are on file: an ID/passport number (typed,
  // never scanned) and an Authority to Act document. KYC, KYB, AML and PEP no longer gate
  // registration at all — those only run later, scoped to a specific deal, at the WaD gate.
  const needsRegistrationDetails =
    !loading && !!profile && !needsOrg && (!profile.id_number || !profile.authority_to_act_path);

  useEffect(() => {
    if (!mustVerify && needsOrg && !onOrgSetup) navigate({ to: "/account/settings", replace: true });
  }, [mustVerify, needsOrg, onOrgSetup, navigate]);

  if (needsOrg && !onOrgSetup && !mustVerify) return null;
  return (
    <>
      <ActivityTracker />
      <Outlet />
      <VerifyEmailDialog open={mustVerify} />
      <RegistrationDetailsDialog open={!mustVerify && needsRegistrationDetails} />
    </>
  );
}
