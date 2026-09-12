import { createFileRoute } from "@tanstack/react-router";
import { DeveloperShell } from "@/components/layout/DeveloperShell";

export const Route = createFileRoute("/_authenticated/developer/schema")({
  head: () => ({
    meta: [{ title: "Schema Explorer — Developer Centre" }],
  }),
  component: SchemaExplorerPage,
});

const ENDPOINTS = [
  { method: "GET", path: "/status", desc: "Gateway health check. Unauthenticated." },
  { method: "POST", path: "/counterparty/lookup", desc: "Look up a counterparty by name. Body: { name }." },
  { method: "GET", path: "/counterparty/summary/:id", desc: "Read the governed risk summary for one counterparty." },
  { method: "GET", path: "/usage", desc: "Your API key's usage against its monthly allowance." },
  { method: "POST", path: "/webhook/test", desc: "Fire a signed test event to your registered endpoint. Sandbox only." },
];

function SchemaExplorerPage() {
  return (
    <DeveloperShell title="Schema Explorer" description="A condensed view of the most-used request and response shapes.">
      <div className="divide-y divide-slate-800 overflow-hidden rounded-md border border-slate-800 bg-slate-900">
        {ENDPOINTS.map((e) => (
          <div key={e.path} className="flex flex-wrap items-center gap-3 p-4">
            <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[11px] font-semibold text-emerald-400">
              {e.method}
            </span>
            <span className="font-mono text-sm text-slate-200">{e.path}</span>
            <span className="text-sm text-slate-500">{e.desc}</span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-slate-500">
        Full request/response bodies live in{" "}
        <a href="/developer/docs" className="text-emerald-400 hover:underline">
          Integration Docs
        </a>
        .
      </p>
    </DeveloperShell>
  );
}
