import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VerificationPanel } from "@/components/verification/VerificationPanel";
import { listMyVerifications } from "@/lib/didit.functions";

export const Route = createFileRoute("/_authenticated/verify-identity")({
  validateSearch: (search: Record<string, unknown>): { next?: string } => {
    const value = search["next"];
    return typeof value === "string" ? { next: value } : {};
  },
  head: () => ({
    meta: [{ title: "Verify Your Identity — Izenzo" }],
  }),
  component: VerifyIdentity,
});

function safeNext(next: string | undefined) {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/live-deal-engine";
}

function VerifyIdentity() {
  const { next } = Route.useSearch();
  const navigate = useNavigate();
  const listMine = useServerFn(listMyVerifications);

  const { data: rows = [] } = useQuery({
    queryKey: ["identity-verifications", "me"],
    queryFn: () => listMine({}),
    refetchInterval: 4000,
  });

  const verified = rows.some((r) => r.check_type === "id_document" && r.status === "passed");

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-5 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Step 3 of 3</p>
          <h1 className="mt-2 text-xl font-semibold tracking-tight">Verify your identity</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            One ID photo and a selfie — this unlocks your workspace and gives your profile a
            verified badge.
          </p>
        </div>

        <VerificationPanel
          checks={["id_document"]}
          title="Identity verification"
          description="Opens a hosted verification session in a new tab. The result lands back here on its own — there's nothing to fill in."
        />

        {verified && (
          <div className="flex items-center gap-2 rounded-lg border border-success/40 bg-success/10 p-3 text-sm text-success">
            <BadgeCheck className="h-4 w-4 shrink-0" />
            Verified — you're all set.
          </div>
        )}

        <Button
          className="w-full"
          disabled={!verified}
          onClick={() => navigate({ to: safeNext(next), replace: true })}
        >
          Continue to workspace
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          Having trouble?{" "}
          <Link to="/support" className="font-medium text-foreground hover:underline">
            Contact support
          </Link>
        </p>
      </div>
    </div>
  );
}
