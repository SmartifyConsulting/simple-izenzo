import { createFileRoute } from "@tanstack/react-router";
import { DeveloperShell } from "@/components/layout/DeveloperShell";

export const Route = createFileRoute("/_authenticated/developer/docs")({
  head: () => ({
    meta: [{ title: "Integration Docs — Developer Centre" }],
  }),
  component: IntegrationDocsPage,
});

const RESOURCES = [
  { title: "Trade Requests & Matches", blurb: "A Trade Request is the persistent unit of intent; a Match is the bilateral child record that runs through the POI state machine." },
  { title: "Counterparties", blurb: "Verified organisations you can transact with. KYB, UBO, Authority-to-Bind." },
  { title: "Evidence Packs", blurb: "Tamper-evident, SHA-256-sealed audit record for every settled deal, including the Without a Doubt (WaD) certificate." },
  { title: "Webhooks", blurb: "Signed HTTP callbacks for state changes. HMAC-SHA256 verification, automatic retries." },
];

function IntegrationDocsPage() {
  return (
    <DeveloperShell title="Integration Docs" description="Core resources — every API call manipulates one of these four primitives.">
      <p className="max-w-2xl text-sm leading-relaxed text-slate-400">
        Izenzo is governance infrastructure for cross-border trade. Use the API to verify
        counterparties, open Trade Requests, mint cryptographically sealed Proof of Intent (POI),
        seal the Without a Doubt (WaD) certificate, and produce tamper-evident evidence packs your
        auditors can verify offline.
      </p>

      <div className="mt-6 space-y-4">
        {RESOURCES.map((r) => (
          <div key={r.title} className="rounded-md border border-slate-800 bg-slate-900 p-4">
            <h3 className="text-sm font-semibold text-slate-100">{r.title}</h3>
            <p className="mt-1 text-sm text-slate-400">{r.blurb}</p>
          </div>
        ))}
      </div>

      <p className="mt-6 rounded-md border border-slate-800 bg-slate-950 p-3 font-mono text-xs text-slate-400">
        https://api.trade.izenzo.co.za/functions/v1/api-gateway/&lt;environment&gt;/v1/&lt;path&gt;
      </p>
    </DeveloperShell>
  );
}
