import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, FileCheck2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { money, when, type Transaction } from "@/lib/tx";

/** Once Without a Doubt has cleared, the live workspace stops being a to-do list and becomes a
 * record: the trade itself, everything that has happened between the parties with its date, and
 * the certificates on file. Read-only — it changes nothing about the deal. */
export function TradeSummary({ tx }: { tx: Transaction }) {
  const { data } = useQuery({
    queryKey: ["trade-summary", tx.id, tx.wad_completed_at],
    queryFn: async () => {
      const [events, docs, counterparty] = await Promise.all([
        supabase
          .from("transaction_events")
          .select("id, summary, action, actor_name, created_at")
          .eq("transaction_id", tx.id)
          .order("created_at", { ascending: true }),
        supabase
          .from("documents")
          .select("id, name, doc_type, created_at")
          .eq("transaction_id", tx.id)
          .eq("doc_type", "certificate")
          .order("created_at", { ascending: true }),
        supabase
          .from("counterparties")
          .select("name, jurisdiction")
          .eq("transaction_id", tx.id)
          .eq("status", "chosen")
          .maybeSingle(),
      ]);
      return {
        events: events.data ?? [],
        certificates: docs.data ?? [],
        counterparty: counterparty.data ?? null,
      };
    },
  });

  const facts: [string, string][] = [
    ["Reference", tx.reference ?? tx.id.slice(0, 8)],
    ["Commodity", tx.commodity ?? "—"],
    ["Quantity", `${tx.quantity ?? "—"} ${tx.unit ?? ""}`.trim()],
    ["Price", money(tx.price, tx.currency)],
    ["Incoterms", tx.incoterms ?? "—"],
    ["Jurisdiction", tx.jurisdiction ?? "—"],
    ["Counterparty", data?.counterparty?.name ?? "—"],
  ];

  return (
    <div className="glass-node space-y-4 p-4">
      <div>
        <p className="label-caps text-muted-foreground">Trade summary</p>
        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
          {facts.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="truncate font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div>
        <p className="label-caps text-muted-foreground">What has happened</p>
        <ul className="mt-2 space-y-1.5">
          {(data?.events ?? []).map((e) => (
            <li key={e.id} className="flex items-start gap-2 text-xs">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
              <span className="min-w-0">
                <span className="block truncate">{e.summary ?? e.action}</span>
                <span className="text-muted-foreground">
                  {when(e.created_at)}
                  {e.actor_name ? ` · ${e.actor_name}` : ""}
                </span>
              </span>
            </li>
          ))}
          {(data?.events ?? []).length === 0 && (
            <li className="text-xs text-muted-foreground">Nothing recorded yet.</li>
          )}
        </ul>
      </div>

      {(data?.certificates ?? []).length > 0 && (
        <div>
          <p className="label-caps text-muted-foreground">Certificates on file</p>
          <ul className="mt-2 space-y-1.5">
            {data!.certificates.map((c) => (
              <li key={c.id} className="flex items-center gap-2 text-xs">
                <FileCheck2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{c.name}</span>
                <span className="ml-auto shrink-0 text-muted-foreground">{when(c.created_at)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
