import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, Download, FileText } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AuthorityDocumentCard } from "@/components/verification/AuthorityDocumentCard";
import { ProofOfResidenceCard } from "@/components/verification/ProofOfResidenceCard";
import { supabase } from "@/integrations/supabase/client";
import { readDocument } from "@/lib/documents.functions";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

type DocRow = {
  id: string;
  name: string;
  doc_type: string | null;
  notes: string | null;
  storage_path: string | null;
  created_at: string;
  transaction_id: string;
};

type DealLite = { id: string; reference: string | null; title: string | null };

/** Every document uploaded against any of this organisation's bids/offers, grouped by the month
 * it was uploaded and the Bid ID it belongs to — searchable across name, type, notes, Bid ID and
 * bid title. The Authority to Act document lives here too, as its own card above the grouped
 * list, rather than taking up room in My Profile. */
export function DocumentsTab() {
  const { org, profile } = useAuth();
  const [search, setSearch] = useState("");
  const [openMonths, setOpenMonths] = useState<Set<string>>(
    new Set([new Date().toISOString().slice(0, 7)]),
  );
  const [openBids, setOpenBids] = useState<Set<string>>(new Set());
  const [opening, setOpening] = useState<string | null>(null);
  const readDoc = useServerFn(readDocument);

  const { data: deals = [] } = useQuery({
    queryKey: ["documents-tab-deals", org?.id],
    enabled: Boolean(org?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("id, reference, title")
        .eq("org_id", org!.id)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as DealLite[];
    },
  });

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["documents-tab-docs", org?.id, deals.map((d) => d.id).join(",")],
    enabled: Boolean(org?.id) && deals.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("id, name, doc_type, notes, storage_path, created_at, transaction_id")
        .in(
          "transaction_id",
          deals.map((d) => d.id),
        )
        .order("created_at", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as DocRow[];
    },
  });

  const byDeal = new Map(deals.map((d) => [d.id, d]));
  const q = search.trim().toLowerCase();
  const filtered = docs.filter((d) => {
    if (!q) return true;
    const deal = byDeal.get(d.transaction_id);
    return (
      d.name.toLowerCase().includes(q) ||
      (d.doc_type ?? "").toLowerCase().includes(q) ||
      (d.notes ?? "").toLowerCase().includes(q) ||
      (deal?.reference ?? "").toLowerCase().includes(q) ||
      (deal?.title ?? "").toLowerCase().includes(q)
    );
  });

  const monthGroups = (() => {
    const byMonth = new Map<string, Map<string, DocRow[]>>();
    for (const d of filtered) {
      const month = d.created_at.slice(0, 7);
      if (!byMonth.has(month)) byMonth.set(month, new Map());
      const bids = byMonth.get(month)!;
      if (!bids.has(d.transaction_id)) bids.set(d.transaction_id, []);
      bids.get(d.transaction_id)!.push(d);
    }
    const monthFormatter = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" });
    return [...byMonth.entries()]
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .map(([month, bids]) => ({
        month,
        label: monthFormatter.format(new Date(`${month}-01T00:00:00Z`)),
        bids: [...bids.entries()]
          .map(([transactionId, rows]) => ({
            transactionId,
            deal: byDeal.get(transactionId),
            rows: rows.sort((a, b) => b.created_at.localeCompare(a.created_at)),
          }))
          .sort((a, b) => b.rows[0]!.created_at.localeCompare(a.rows[0]!.created_at)),
      }));
  })();

  function toggleMonth(month: string) {
    setOpenMonths((prev) => {
      const next = new Set(prev);
      if (next.has(month)) next.delete(month);
      else next.add(month);
      return next;
    });
  }
  function toggleBid(key: string) {
    setOpenBids((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function openDoc(d: DocRow) {
    if (!d.storage_path) {
      toast.error("This document has no file on file.");
      return;
    }
    const tab = window.open("", "_blank");
    if (tab) {
      tab.document.title = d.name;
      tab.document.body.innerText = "Opening document…";
    }
    setOpening(d.id);
    try {
      const { base64, contentType } = await readDoc({ data: { path: d.storage_path } });
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: contentType });
      const url = URL.createObjectURL(blob);
      if (tab) tab.location.href = url;
      else
        toast.error(
          "Your browser blocked the new tab — allow pop-ups for this site and try again.",
        );
    } catch (err) {
      tab?.close();
      toast.error((err as Error).message || `Could not open ${d.name}`);
    } finally {
      setOpening(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Whichever document this seat registered with — individuals prove where they live, companies
          prove authority to act. Showing the wrong one here would read as a missing document. */}
      {profile &&
        (profile.account_type === "individual" ? (
          <ProofOfResidenceCard />
        ) : (
          <AuthorityDocumentCard />
        ))}

      <div className="rounded-md border border-border p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Documents</h2>
          <Badge variant="outline" className="font-normal">
            {filtered.length} document{filtered.length === 1 ? "" : "s"}
          </Badge>
        </div>
        <Input
          placeholder="Search by name, type, notes, Bid ID or title…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-3"
        />

        <div className="space-y-2">
          {isLoading ? (
            <p className="rounded-md border border-border p-6 text-sm text-muted-foreground">
              Loading…
            </p>
          ) : monthGroups.length === 0 ? (
            <p className="rounded-md border border-border p-6 text-sm text-muted-foreground">
              {q ? "Nothing matches that search." : "No documents uploaded yet."}
            </p>
          ) : (
            monthGroups.map((mg) => {
              const monthOpen = openMonths.has(mg.month);
              const docCount = mg.bids.reduce((n, b) => n + b.rows.length, 0);
              return (
                <div key={mg.month} className="overflow-hidden rounded-md border border-border">
                  <button
                    type="button"
                    onClick={() => toggleMonth(mg.month)}
                    className="flex w-full items-center justify-between gap-2 bg-muted/40 px-4 py-2.5 text-left"
                    aria-expanded={monthOpen}
                  >
                    <span className="text-sm font-semibold">{mg.label}</span>
                    <span className="flex items-center gap-2">
                      <Badge variant="outline" className="font-normal">
                        {mg.bids.length} bid{mg.bids.length === 1 ? "" : "s"} · {docCount} doc
                        {docCount === 1 ? "" : "s"}
                      </Badge>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 text-muted-foreground transition-transform",
                          monthOpen && "rotate-180",
                        )}
                      />
                    </span>
                  </button>
                  {monthOpen && (
                    <div className="divide-y divide-border">
                      {mg.bids.map((bg) => {
                        const bidKey = `${mg.month}:${bg.transactionId}`;
                        const bidOpen = openBids.has(bidKey);
                        return (
                          <div key={bidKey}>
                            <button
                              type="button"
                              onClick={() => toggleBid(bidKey)}
                              className="flex w-full items-center justify-between gap-2 px-4 py-2 text-left hover:bg-accent/50"
                              aria-expanded={bidOpen}
                            >
                              <span className="flex min-w-0 items-center gap-2">
                                <span className="shrink-0 font-mono text-xs font-semibold">
                                  {bg.deal?.reference ?? bg.transactionId.slice(0, 8)}
                                </span>
                                {bg.deal?.title && (
                                  <span className="min-w-0 truncate text-xs text-muted-foreground">
                                    {bg.deal.title}
                                  </span>
                                )}
                              </span>
                              <span className="flex shrink-0 items-center gap-2">
                                <span className="text-xs text-muted-foreground">
                                  {bg.rows.length} doc{bg.rows.length === 1 ? "" : "s"}
                                </span>
                                <ChevronDown
                                  className={cn(
                                    "h-3.5 w-3.5 text-muted-foreground transition-transform",
                                    bidOpen && "rotate-180",
                                  )}
                                />
                              </span>
                            </button>
                            {bidOpen && (
                              <ul className="divide-y divide-border border-t border-border">
                                {bg.rows.map((d) => (
                                  <li
                                    key={d.id}
                                    className="flex items-center justify-between gap-3 px-4 py-2"
                                  >
                                    <span className="flex min-w-0 items-center gap-2">
                                      <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                      <span className="min-w-0 truncate text-xs font-medium">
                                        {d.name}
                                      </span>
                                      {d.doc_type && (
                                        <Badge variant="outline" className="shrink-0 font-normal">
                                          {d.doc_type}
                                        </Badge>
                                      )}
                                    </span>
                                    <span className="flex shrink-0 items-center gap-3">
                                      <span className="text-xs text-muted-foreground">
                                        {new Date(d.created_at).toLocaleDateString()}
                                      </span>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 gap-1 text-xs"
                                        disabled={opening === d.id}
                                        onClick={() => void openDoc(d)}
                                      >
                                        <Download className="h-3.5 w-3.5" />
                                        {opening === d.id ? "Opening…" : "Open"}
                                      </Button>
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
