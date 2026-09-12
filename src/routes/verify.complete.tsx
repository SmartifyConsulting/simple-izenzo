import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { BadgeCheck, Loader2, ShieldAlert, ShieldQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { finaliseVerificationPublic } from "@/lib/didit.functions";

/** Where the identity provider returns people once a check is finished. Deliberately public: the
 * popup/tab the provider hands back often carries no session, and sending it to a signed-in page
 * bounced people out to the marketing site. */
export const Route = createFileRoute("/verify/complete")({
  ssr: false,
  validateSearch: z.object({ vid: z.string().uuid().optional() }),
  head: () => ({
    meta: [
      { title: "Verification complete — Izenzo" },
      { name: "description", content: "The result of your Izenzo identity check." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Verification complete — Izenzo" },
      { property: "og:description", content: "The result of your Izenzo identity check." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VerifyComplete,
});

type Status = "pending" | "in_progress" | "passed" | "review" | "failed" | "expired";

const MAX_POLLS = 15; // ~30s at 2s apart

function VerifyComplete() {
  const { vid } = Route.useSearch();
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(Boolean(vid));
  const polls = useRef(0);
  const closedSelf = useRef(false);

  useEffect(() => {
    if (!vid) return;
    let stop = false;

    async function tick() {
      try {
        const res = await finaliseVerificationPublic({ data: { vid: vid! } });
        if (stop) return;
        setStatus(res.status);
        setError(null);
        if (res.status === "passed" || res.status === "failed" || res.status === "expired") {
          setChecking(false);
          return;
        }
      } catch (err) {
        if (stop) return;
        setError((err as Error).message);
      }
      polls.current += 1;
      if (polls.current >= MAX_POLLS) {
        setChecking(false);
        return;
      }
      if (!stop) window.setTimeout(tick, 2000);
    }

    void tick();
    return () => {
      stop = true;
    };
  }, [vid]);

  // Opened as a popup from the app? Hand control back and close, so the workspace behind updates
  // on its own (it polls the verification state).
  useEffect(() => {
    if (status !== "passed" || closedSelf.current) return;
    if (typeof window === "undefined" || !window.opener) return;
    closedSelf.current = true;
    const timer = window.setTimeout(() => window.close(), 1600);
    return () => window.clearTimeout(timer);
  }, [status]);

  function retry() {
    polls.current = 0;
    setChecking(true);
    setError(null);
    if (vid) {
      void finaliseVerificationPublic({ data: { vid } })
        .then((res) => setStatus(res.status))
        .catch((err) => setError((err as Error).message))
        .finally(() => setChecking(false));
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-16">
      <div className="rounded-xl border border-border p-6">
        {!vid ? (
          <>
            <h1 className="text-lg font-semibold">Nothing to show</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This page shows the result of an identity check, but no check was referenced.
            </p>
          </>
        ) : status === "passed" ? (
          <>
            <div className="flex items-center gap-2 text-success">
              <BadgeCheck className="h-5 w-5" />
              <h1 className="text-lg font-semibold">Verified — you&apos;re done</h1>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Your identity check passed and your verified badge is in place. You can close this
              window and carry on in the app.
            </p>
          </>
        ) : status === "failed" || status === "expired" ? (
          <>
            <div className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" />
              <h1 className="text-lg font-semibold">Not approved</h1>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {status === "expired"
                ? "The check ran out of time before it finished. You can start a new one from the app."
                : "The check was not approved. You can start a new one from the app, or contact support if you think this is wrong."}
            </p>
          </>
        ) : status === "review" ? (
          <>
            <div className="flex items-center gap-2 text-warning-foreground">
              <ShieldQuestion className="h-5 w-5" />
              <h1 className="text-lg font-semibold">Still being reviewed</h1>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Your check needs a person to look at it. Nothing more for you to do — the result
              lands in the app on its own.
            </p>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              {checking && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
              <h1 className="text-lg font-semibold">
                {checking ? "Checking your result…" : "No result yet"}
              </h1>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {checking
                ? "This takes a few seconds. Please keep this window open."
                : "The result has not come through yet. It can take a minute — try again, or carry on in the app and it will appear there."}
            </p>
          </>
        )}

        {error && (
          <p className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <Link to="/live-deal-engine">
            <Button size="sm">Go to your workspace</Button>
          </Link>
          {vid && (
            <Button size="sm" variant="outline" disabled={checking} onClick={retry}>
              {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Check again"}
            </Button>
          )}
        </div>
      </div>
    </main>
  );
}
