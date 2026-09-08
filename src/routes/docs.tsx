import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";

export const Route = createFileRoute("/docs")({
  head: () => ({
    meta: [{ title: "Developer Docs — Izenzo" }],
  }),
  component: Docs,
});

const GUIDES = [
  { title: "Quickstart", blurb: "Issue an API key and make your first authenticated call in under five minutes.", to: "/docs/api" },
  { title: "Authentication", blurb: "API keys, scopes, rate limits, and the lockout policy.", to: "/docs/api" },
  { title: "Webhooks", blurb: "Signed HMAC-SHA256 callbacks for state changes, with automatic retries and dead-letter queue.", to: "/docs/webhooks" },
  { title: "API Reference", blurb: "Every endpoint, parameter, response shape, and error code.", to: "/docs/api" },
];

const RESOURCES = [
  { title: "Trade Requests & Matches", blurb: "A Trade Request is the persistent unit of intent; a Match is the bilateral child record that runs through the POI state machine." },
  { title: "Counterparties", blurb: "Verified organisations you can transact with. KYB, UBO, Authority-to-Bind." },
  { title: "Evidence Packs", blurb: "Tamper-evident, SHA-256-sealed audit record for every settled deal, including the Without a Doubt (WaD) certificate." },
  { title: "Webhooks", blurb: "Signed HTTP callbacks for state changes. HMAC-SHA256 verification, automatic retries." },
];

function Docs() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader logoClassName="h-7" containerClassName="max-w-6xl h-auto py-8 px-5" />
      <main className="mx-auto max-w-4xl px-5 py-16">
        <p className="label-caps text-primary">Documentation</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Izenzo Developer Docs</h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Izenzo is governance infrastructure for cross-border trade. Use the API to verify
          counterparties, open Trade Requests, mint cryptographically sealed Proof of Intent
          (POI), seal the Without a Doubt (WaD) certificate, and produce tamper-evident evidence
          packs your auditors can verify offline.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {GUIDES.map((g) => (
            <Link
              key={g.title}
              to={g.to}
              className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40"
            >
              <h3 className="text-sm font-semibold">{g.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{g.blurb}</p>
              <span className="mt-3 inline-block text-sm font-medium text-primary">Open →</span>
            </Link>
          ))}
        </div>

        <h2 className="mt-14 text-lg font-semibold tracking-tight">Core resources</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Every API call manipulates one of four primitives. Read these once and the rest of the
          surface area follows naturally.
        </p>
        <div className="mt-6 space-y-5">
          {RESOURCES.map((r) => (
            <div key={r.title} className="border-b border-border pb-5">
              <h3 className="text-sm font-semibold">{r.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{r.blurb}</p>
            </div>
          ))}
        </div>

        <h2 className="mt-14 text-lg font-semibold tracking-tight">Base URL &amp; versioning</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          All endpoints are served from a single base URL. The API is unversioned at the path
          level; backwards-incompatible changes are announced 90 days in advance via the developer
          changelog and your account contact.
        </p>
        <p className="mt-3 seal-block w-fit">https://api.trade.izenzo.co.za/functions/v1</p>
      </main>
      <SiteFooter />
    </div>
  );
}
