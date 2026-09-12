import {
  createFileRoute,
  Outlet,
  redirect,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { VerifyEmailDialog } from "@/components/auth/VerifyEmailDialog";
import { VerifyIdentityDialog } from "@/components/verification/VerifyIdentityDialog";
import { ActivityTracker } from "@/components/ActivityTracker";

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

  // A new account isn't fully verified until it clears all three checks — the individual
  // KYC/AML identity check plus the KYB company check. Missing any one of them keeps the
  // gate open.
  const REQUIRED_CHECKS = ["id_document", "aml", "kyb"] as const;

  const { data: verificationRows, isLoading: verificationLoading } = useQuery({
    queryKey: ["identity-verifications", "me", user?.id],
    enabled: !loading && !!user && !needsOrg,
    // Polled the same way the old standalone /verify-identity page was, so a passed check (Didit
    // reports it asynchronously) closes this dialog on its own rather than needing a reload.
    refetchInterval: 4000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("identity_verifications")
        .select("check_type, status")
        .eq("subject_user_id", user!.id)
        .in("check_type", REQUIRED_CHECKS);
      if (error) throw error;
      return data;
    },
  });
  const passedChecks = new Set(
    (verificationRows ?? []).filter((r) => r.status === "passed").map((r) => r.check_type),
  );
  const isIdVerified = REQUIRED_CHECKS.every((c) => passedChecks.has(c));

  // Asked for, not enforced here: the hosted provider page cannot render inside the app's frame,
  // so a hard block would leave people with nowhere to go. Dismissing it lasts for this browser
  // session only, and the real compliance gates still require a passed check.
  const [idDismissed, setIdDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.sessionStorage.getItem("izenzo:identity-later") === "1";
  });
  const needsIdentity =
    !loading && !!profile && !needsOrg && !verificationLoading && !isIdVerified && !idDismissed;

  useEffect(() => {
    if (!mustVerify && needsOrg && !onOrgSetup) navigate({ to: "/account/settings", replace: true });
  }, [mustVerify, needsOrg, onOrgSetup, navigate]);

  if (needsOrg && !onOrgSetup && !mustVerify) return null;
  return (
    <>
      <ActivityTracker />
      <Outlet />
      <VerifyEmailDialog open={mustVerify} />
      <VerifyIdentityDialog
        open={!mustVerify && needsIdentity}
        verified={isIdVerified}
        onDismiss={() => {
          if (typeof window !== "undefined") window.sessionStorage.setItem("izenzo:identity-later", "1");
          setIdDismissed(true);
        }}
      />
    </>
  );
}
