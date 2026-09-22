import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, XCircle } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { respondAsCounterparty } from "@/lib/counterpartyClaim.functions";
import { InlineFrame } from "@/components/canvas/DealCanvas";
import { money, tradeKindOf, when, type Transaction } from "@/lib/tx";

/**
 * What a linked counterparty organisation actually sees when it opens the same workspace URL a
 * bidder would: Bid Registration, Bid Information, and every frame from Proof of Intent onward —
 * read-only (InlineFrame's own `viewOnly`), the same components the bidder sees rendering the same
 * record, not a re-described summary of it. Search, AI/AI+, Choice and Online Media never appear
 * here — those are the bidder's own working steps, not shared transparency.
 */
export function CounterpartyWorkspaceView({ tx, reload }: { tx: Transaction; reload: () => void }) {
  const qc = useQueryClient();
  const respond = useServerFn(respondAsCounterparty);
  const [responding, setResponding] = useState<"accepted" | "declined" | null>(null);

  const { data: chosenCp } = useQuery({
    queryKey: ["counterparty-self", tx.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("counterparties")
        .select("id, name, counterparty_response, counterparty_responded_at")
        .eq("transaction_id", tx.id)
        .eq("status", "chosen")
        .maybeSingle();
      return data as {
        id: string;
        name: string;
        counterparty_response: "accepted" | "declined" | null;
        counterparty_responded_at: string | null;
      } | null;
    },
  });

  const { data: docs = [] } = useQuery({
    queryKey: ["counterparty-view-documents", tx.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("documents")
        .select("id, name, doc_type, created_at")
        .eq("transaction_id", tx.id)
        .order("created_at", { ascending: true });
      return data ?? [];
    },
  });

  async function respondTo(response: "accepted" | "declined") {
    setResponding(response);
    try {
      await respond({ data: { transactionId: tx.id, response } });
      toast.success(response === "accepted" ? "You've accepted this deal." : "You've opted out of this deal.");
      await qc.invalidateQueries({ queryKey: ["counterparty-self", tx.id] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setResponding(null);
    }
  }

  const kind = tradeKindOf(tx.reference);
  const kindWord = kind === "offer" ? "Offer" : "Bid";
  const canRespond = !tx.intent_confirmed_at && !tx.poi_sealed_at;
  const responded = chosenCp?.counterparty_response ?? null;

  return (
    <AppShell wide title={tx.title} description={`You're viewing this deal as its counterparty — read-only, shared for transparency.`}>
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="glass-node space-y-1.5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span
              className={
                "label-caps rounded-full px-2.5 py-1 " +
                (kind === "offer" ? "bg-[#4169e1] text-white" : "bg-emerald-600 text-white")
              }
            >
              {kindWord} Registration
            </span>
            <span className="font-mono text-xs text-muted-foreground">{tx.reference}</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Registered {when(tx.created_at)} · {money(tx.price, tx.currency)}
            {Number(tx.quantity) > 0 ? ` · ${tx.quantity} ${tx.unit ?? ""}` : ""}
          </p>
        </div>

        <div className="glass-node space-y-2 p-4">
          <span className="label-caps inline-block rounded-full bg-[var(--lw-pill-bg)] px-2.5 py-1 text-[var(--lw-pill-fg)]">
            {kindWord} Information
          </span>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <p><span className="text-muted-foreground">Commodity:</span> {tx.commodity ?? "—"}</p>
            <p><span className="text-muted-foreground">Jurisdiction:</span> {tx.jurisdiction ?? "—"}</p>
            <p><span className="text-muted-foreground">Incoterms:</span> {tx.incoterms ?? "—"}</p>
          </div>
          {(tx as unknown as { document_summary?: string | null }).document_summary && (
            <div className="mt-2 rounded-lg bg-muted/40 p-3 text-xs leading-relaxed text-foreground">
              {(tx as unknown as { document_summary?: string | null }).document_summary}
            </div>
          )}
          {docs.length > 0 && (
            <ul className="mt-2 space-y-1 border-t border-border pt-2 text-xs text-muted-foreground">
              {docs.map((d) => (
                <li key={d.id}>{d.name}</li>
              ))}
            </ul>
          )}
        </div>

        {canRespond && (
          <div className="glass-node space-y-2 p-4">
            <p className="text-sm font-medium">Your response</p>
            <p className="text-xs text-muted-foreground">
              You can accept or opt out of this deal at any point before it's binding — opting out
              is always available up until Proof of Intent is sealed.
            </p>
            {responded ? (
              <p className="flex items-center gap-1.5 text-sm font-medium">
                {responded === "accepted" ? (
                  <CheckCircle2 className="h-4 w-4 text-success" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive" />
                )}
                You {responded} this deal
                {chosenCp?.counterparty_responded_at ? ` — ${when(chosenCp.counterparty_responded_at)}` : ""}.
              </p>
            ) : (
              <div className="flex gap-2">
                <Button size="sm" disabled={responding !== null} onClick={() => void respondTo("accepted")}>
                  {responding === "accepted" ? "Accepting…" : "Accept"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-destructive/40 text-destructive hover:bg-destructive/10"
                  disabled={responding !== null}
                  onClick={() => void respondTo("declined")}
                >
                  {responding === "declined" ? "Opting out…" : "Opt out"}
                </Button>
              </div>
            )}
          </div>
        )}

        {tx.intent_confirmed_at && (
          <div className="glass-node p-4">
            <span className="label-caps mb-2 inline-block rounded-full bg-[var(--lw-pill-bg)] px-2.5 py-1 text-[var(--lw-pill-fg)]">
              Confirmed Intent
            </span>
            <InlineFrame bare viewOnly tx={tx} stage="trading" step="intent" reload={reload} onClose={() => {}} />
          </div>
        )}

        {tx.poi_sealed_at && (
          <div className="glass-node p-4">
            <span className="label-caps mb-2 inline-block rounded-full bg-[var(--lw-pill-bg)] px-2.5 py-1 text-[var(--lw-pill-fg)]">
              Seal Intent
            </span>
            <InlineFrame bare viewOnly tx={tx} stage="trading" step="poi" reload={reload} onClose={() => {}} />
          </div>
        )}

        {tx.wad_completed_at && (
          <div className="glass-node p-4">
            <span className="label-caps mb-2 inline-block rounded-full bg-[var(--lw-pill-bg)] px-2.5 py-1 text-[var(--lw-pill-fg)]">
              Without a Doubt
            </span>
            <InlineFrame bare viewOnly tx={tx} stage="compliance" step="wad" reload={reload} onClose={() => {}} />
          </div>
        )}

        {tx.finality_sealed_at && (
          <div className="glass-node p-4">
            <span className="label-caps mb-2 inline-block rounded-full bg-[var(--lw-pill-bg)] px-2.5 py-1 text-[var(--lw-pill-fg)]">
              Finality
            </span>
            <InlineFrame bare viewOnly tx={tx} stage="finality" step="record" reload={reload} onClose={() => {}} />
          </div>
        )}
      </div>
    </AppShell>
  );
}
