import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { MapView } from "@/components/canvas/MapView";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Transaction } from "@/lib/tx";

export const Route = createFileRoute("/_authenticated/map")({
  head: () => ({
    meta: [
      { title: "Deal Map — Izenzo" },
      { name: "description", content: "The whole Izenzo deal pipeline on one map, live for your deal." },
      { property: "og:title", content: "Deal Map — Izenzo" },
      { property: "og:description", content: "The whole Izenzo deal pipeline on one map, live for your deal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MapScreen,
});

function MapScreen() {
  const [selected, setSelected] = useState<string | null>(null);

  const { data: deals = [], refetch } = useQuery({
    queryKey: ["map-deals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as Transaction[];
    },
  });

  const tx = deals.find((d) => d.id === selected) ?? deals[0] ?? null;

  return (
    <AppShell
      title="Deal Map"
      description="The whole pipeline on one map. Cleared steps are ticked, the current step pulses, and locked steps open once their gate is met."
    >
      {deals.length > 1 && (
        <div className="mb-4 max-w-sm">
          <Select value={tx?.id ?? ""} onValueChange={(v) => setSelected(v)}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a deal" />
            </SelectTrigger>
            <SelectContent>
              {deals.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.reference ? `${d.reference} · ` : ""}
                  {d.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {tx ? (
        <div className="w-full">
          <MapView tx={tx} reload={() => void refetch()} />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          You have no deals yet. Register a bid or offer in the Live Workspace and it will appear here.
        </p>
      )}
    </AppShell>
  );
}
