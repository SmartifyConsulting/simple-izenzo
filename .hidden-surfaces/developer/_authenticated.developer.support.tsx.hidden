import { createFileRoute } from "@tanstack/react-router";
import { LifeBuoy } from "lucide-react";
import { DeveloperShell } from "@/components/layout/DeveloperShell";

export const Route = createFileRoute("/_authenticated/developer/support")({
  head: () => ({
    meta: [{ title: "API Support — Developer Centre" }],
  }),
  component: ApiSupportPage,
});

function ApiSupportPage() {
  return (
    <DeveloperShell title="API Support" description="Talk to engineering — key issues, unexpected errors, webhook delivery problems.">
      <div className="max-w-lg rounded-md border border-slate-800 bg-slate-900 p-6">
        <LifeBuoy className="h-5 w-5 text-emerald-400" />
        <p className="mt-3 text-sm text-slate-300">
          For anything involving credentials, rate limits, or an endpoint behaving unexpectedly,
          email the integration team directly with your key prefix and a request ID from the{" "}
          <span className="text-slate-100">API Usage</span> log — that's enough for us to trace
          the exact call.
        </p>
        <a href="mailto:support@izenzo.co.za?subject=API%20Support%20request">
          <button className="mt-4 rounded-md bg-emerald-500/15 px-3 py-2 text-sm font-medium text-emerald-400 hover:bg-emerald-500/25">
            Email API support
          </button>
        </a>
      </div>
    </DeveloperShell>
  );
}
