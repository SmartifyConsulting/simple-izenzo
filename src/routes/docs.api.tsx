import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";

export const Route = createFileRoute("/docs/api")({
  head: () => ({
    meta: [{ title: "API Reference — Izenzo Docs" }],
  }),
  component: DocsApi,
});

const ENDPOINTS = [
  { method: "GET", path: "/status", desc: "Gateway health check. Unauthenticated." },
  { method: "POST", path: "/counterparty/lookup", desc: "Look up a counterparty by name. Body: { name }." },
  { method: "GET", path: "/counterparty/summary/:id", desc: "Read the governed risk summary for one counterparty." },
  { method: "GET", path: "/usage", desc: "Your API key's usage against its monthly allowance." },
  { method: "POST", path: "/webhook/test", desc: "Fire a signed test event to your registered endpoint. Sandbox only." },
];

function DocsApi() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader logoClassName="h-7" containerClassName="max-w-6xl h-auto py-8 px-5" />
      <main className="mx-auto max-w-3xl px-5 py-16">
        <Link to="/docs" className="text-xs font-medium text-primary hover:underline">
          ← Docs
        </Link>
        <p className="label-caps mt-4 text-primary">API Reference</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Authentication &amp; endpoints</h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Every request is scoped to an environment — <code>sandbox</code> or{" "}
          <code>production</code> — carried in the URL path. A key issued for one environment is
          rejected outright against the other. Sandbox records are fictional test data and must
          never be used for live business, compliance, or payment decisions.
        </p>

        <p className="mt-6 seal-block w-fit">
          https://api.trade.izenzo.co.za/functions/v1/api-gateway/&lt;environment&gt;/v1/&lt;path&gt;
        </p>

        <h2 className="mt-10 text-lg font-semibold tracking-tight">Endpoints</h2>
        <div className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border">
          {ENDPOINTS.map((e) => (
            <div key={e.path} className="flex flex-wrap items-center gap-3 p-4">
              <span className="rounded bg-muted px-2 py-0.5 font-mono text-[11px] font-semibold text-foreground">
                {e.method}
              </span>
              <span className="font-mono text-sm">{e.path}</span>
              <span className="text-sm text-muted-foreground">{e.desc}</span>
            </div>
          ))}
        </div>

        <p className="mt-8 text-sm text-muted-foreground">
          Manage keys and rotate secrets from{" "}
          <Link to="/auth" className="font-medium text-primary hover:underline">
            your account
          </Link>
          , under Admin → Integrations.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
