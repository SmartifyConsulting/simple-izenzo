import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { claimCounterparty } from "@/lib/counterpartyClaim.functions";

export const Route = createFileRoute("/_authenticated/counterparty/claim")({
  validateSearch: (search: Record<string, unknown>) => ({
    cp: typeof search["cp"] === "string" ? search["cp"] : undefined,
  }),
  head: () => ({
    meta: [{ title: "Link your organisation — Izenzo" }],
  }),
  component: ClaimPage,
});

/** Where the "Sign in to respond" / "Create your free account" link in the counterparty-chosen
 * email actually leads: being signed in (the _authenticated layout already sends anyone who isn't
 * to /auth and back here afterwards) is enough to complete the link — no separate confirmation
 * click needed beyond the Accept/Opt out choice waiting on the workspace itself. */
function ClaimPage() {
  const { cp } = Route.useSearch();
  const navigate = useNavigate();
  const claim = useServerFn(claimCounterparty);
  const [status, setStatus] = useState<"working" | "error">("working");
  const [error, setError] = useState<string | null>(null);
  const attempted = useRef(false);

  useEffect(() => {
    if (!cp || attempted.current) return;
    attempted.current = true;
    (async () => {
      try {
        const { transactionId } = await claim({ data: { counterpartyId: cp } });
        void navigate({ to: "/live-deal-engine", search: { tx: transactionId }, replace: true });
      } catch (err) {
        setStatus("error");
        setError((err as Error).message || "This link could not be completed.");
      }
    })();
  }, [cp, claim, navigate]);

  if (!cp) {
    return (
      <AppShell title="Link your organisation">
        <p className="text-sm text-muted-foreground">This link is missing what it needs to work — check it was copied in full.</p>
      </AppShell>
    );
  }

  return (
    <AppShell title="Link your organisation">
      {status === "working" ? (
        <p className="text-sm text-muted-foreground">Linking your organisation to this deal…</p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-destructive">{error}</p>
          <Button size="sm" variant="outline" onClick={() => void navigate({ to: "/trades" })}>
            Go to My Trades
          </Button>
        </div>
      )}
    </AppShell>
  );
}
