import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";

export const Route = createFileRoute("/docs/webhooks")({
  head: () => ({
    meta: [{ title: "Webhooks — Izenzo Docs" }],
  }),
  component: DocsWebhooks,
});

function DocsWebhooks() {
  return (
    <div className="flat-frames min-h-screen bg-background">
      <SiteHeader logoClassName="h-7" containerClassName="max-w-6xl h-auto py-8 px-5" />
      <main className="mx-auto max-w-3xl px-5 py-16">
        <Link to="/docs" className="text-xs font-medium text-primary hover:underline">
          ← Docs
        </Link>
        <p className="label-caps mt-4 text-primary">Webhooks</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Signed event callbacks</h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Register an endpoint under Admin → Integrations and Izenzo delivers a signed HTTP POST
          for every state change your key is scoped to see. Each delivery includes an
          <code> HMAC-SHA256</code> signature computed with your endpoint's secret — verify it
          before trusting the payload.
        </p>

        <h2 className="mt-10 text-lg font-semibold tracking-tight">Verifying a signature</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Recompute the HMAC-SHA256 of the raw request body using your endpoint secret, and
          compare it to the <code>X-Izenzo-Signature</code> header using a constant-time
          comparison.
        </p>

        <h2 className="mt-10 text-lg font-semibold tracking-tight">Retries</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          A non-2xx response is retried with backoff. Deliveries that continue to fail are moved
          to a dead-letter queue and surfaced under Admin → Integrations, where you can inspect
          and manually replay them.
        </p>

        <p className="mt-8 text-sm text-muted-foreground">
          Test your endpoint any time from the sandbox environment with{" "}
          <code>POST /webhook/test</code> — see the{" "}
          <Link to="/docs/api" className="font-medium text-primary hover:underline">
            API reference
          </Link>
          .
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
