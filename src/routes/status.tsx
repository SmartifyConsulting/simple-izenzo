import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/status")({
  head: () => ({
    meta: [{ title: "Platform Status — Izenzo" }],
  }),
  component: Status,
});

function Status() {
  const { data, isLoading } = useQuery({
    queryKey: ["marketing-status-ping"],
    queryFn: async () => {
      const start = performance.now();
      const { error } = await supabase.from("admin_settings").select("key").limit(1);
      return { ok: !error, latencyMs: Math.round(performance.now() - start) };
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader logoClassName="h-7" containerClassName="max-w-6xl h-auto py-8 px-5" />
      <main className="mx-auto max-w-2xl px-5 py-20 text-center">
        <p className="label-caps text-primary">Platform information</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          A public, historical status feed is in development.
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">
          For platform availability queries, contact{" "}
          <a href="mailto:support@izenzo.co.za" className="font-medium text-primary hover:underline">
            support@izenzo.co.za
          </a>
          . In the meantime, here's a live check against this database, run when you loaded this
          page.
        </p>

        <div className="mx-auto mt-8 flex w-fit items-center gap-3 rounded-xl border border-border bg-card px-5 py-4">
          <Activity className={`h-5 w-5 ${data?.ok ? "text-success" : "text-muted-foreground"}`} />
          <div className="text-left">
            <p className="text-sm font-semibold">
              {isLoading ? "Checking…" : data?.ok ? "Database reachable" : "Check failed"}
            </p>
            {data && <p className="text-xs text-muted-foreground">{data.latencyMs}ms round-trip</p>}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
