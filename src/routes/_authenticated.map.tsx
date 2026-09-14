import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { MapView } from "@/components/canvas/MapView";
import { DocumentUploadStep } from "@/components/guided/DocumentUploadStep";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { searchCounterparties } from "@/lib/izenzo.functions";
import { advance } from "@/lib/tx";
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
      { name: "description", content: "Run your whole deal from one map, live for your bid." },
      { property: "og:title", content: "Deal Map — Izenzo" },
      { property: "og:description", content: "Run your whole deal from one map, live for your bid." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MapScreen,
});

function MapScreen() {
  const [selected, setSelected] = useState<string | null>(null);
  /** The Live Workspace pane on the right — opened by the Bid tile, then stays for the deal. */
  const [paneOpen, setPaneOpen] = useState(false);
  const [paneKey, setPaneKey] = useState(0);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const runSearch = useServerFn(searchCounterparties);

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

  // While the workspace pane is open the deal is being worked on inside it, so the map keeps its
  // own copy of the record fresh — that's what moves the pulse along from tile to tile.
  useEffect(() => {
    if (!paneOpen) return;
    const timer = setInterval(() => void refetch(), 4000);
    return () => clearInterval(timer);
  }, [paneOpen, refetch]);

  /** Pressing Search in the upload window: the window closes, Search pulses with its progress
   * bar, and the results land in the workspace on the right. */
  async function startSearch(txId: string) {
    if (searching) return;
    setUploadOpen(false);
    setSearching(true);
    try {
      await advance(txId, "trading", "search");
      const [ai, aiPlus] = await Promise.allSettled([
        runSearch({ data: { transactionId: txId, kind: "ai" } }),
        runSearch({ data: { transactionId: txId, kind: "ai_plus" } }),
      ]);
      if (ai.status === "rejected" && aiPlus.status === "rejected") {
        throw ai.reason instanceof Error ? ai.reason : new Error("AI and AI+ search both failed");
      }
      await advance(txId, "trading", "choice");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The search could not be completed");
    } finally {
      setSearching(false);
      await refetch();
      setPaneKey((k) => k + 1);
    }
  }

  const paneSrc = tx
    ? `/live-deal-engine?popout=1&tx=${tx.id}`
    : "/live-deal-engine?popout=1&fresh=1";

  return (
    <AppShell
      wide
      compactFooter
      title="Deal Map"
      description="Run the deal straight from the map: the pulsing tile is what happens next, cleared tiles are ticked, and locked tiles open once their gate is met."
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

      <div className="flex w-full gap-4">
        <div className={paneOpen ? "min-w-0 flex-[0_0_55%]" : "w-full"}>
          <MapView
            tx={tx}
            reload={() => void refetch()}
            searching={searching}
            onBid={() => setPaneOpen(true)}
            onLoadDocuments={() => {
              if (!tx) {
                setPaneOpen(true);
                return;
              }
              setPaneOpen(true);
              setUploadOpen(true);
            }}
          />
        </div>

        {paneOpen && (
          <div className="min-w-0 flex-1">
            <iframe
              key={paneKey}
              src={paneSrc}
              title="Live Workspace"
              className="h-[calc(100vh-14rem)] w-full rounded-2xl border border-border bg-background"
            />
          </div>
        )}
      </div>

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="label-caps font-sans">Load deal documents</DialogTitle>
          </DialogHeader>
          {tx && (
            <DocumentUploadStep
              transactionId={tx.id}
              reference={tx.reference ?? null}
              onNext={() => void startSearch(tx.id)}
            />
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
