import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, TrendingUp, TrendingDown, Handshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BidWizard } from "@/components/guided/BidWizard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { money } from "@/lib/tx";
import { cn } from "@/lib/utils";

type BidOfferRow = {
  id: string;
  transaction_id: string;
  direction: string;
  price: number | null;
  quantity: number | null;
  unit: string | null;
  currency: string;
  created_at: string;
};

type TxRow = {
  id: string;
  title: string;
  commodity: string | null;
};

/** The Simple Mode trading board: Bid-to-Buy and Bid-to-Sell lanes on the outside, with the
 * middle two lanes showing a live trader ticker that resolves into pinned match cards once a
 * transaction has both a bid and an offer against it. Buy matches read terracotta, sell matches
 * read teal. Deliberately its own simplified board — the detailed sidebar/Deal Canvas is unchanged. */
export function TradingBoard() {
  const { org } = useAuth();
  const qc = useQueryClient();
  const [dialogDirection, setDialogDirection] = useState<"bid" | "offer" | null>(null);

  const { data: bidOffers = [] } = useQuery({
    queryKey: ["board-bid-offers", org?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bid_offers")
        .select("id, transaction_id, direction, price, quantity, unit, currency, created_at")
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return (data ?? []) as BidOfferRow[];
    },
  });

  const { data: txs = [] } = useQuery({
    queryKey: ["board-txs", org?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("transactions").select("id, title, commodity").limit(200);
      if (error) throw error;
      return (data ?? []) as TxRow[];
    },
  });

  const { data: tickerNames = [] } = useQuery({
    queryKey: ["board-ticker-names"],
    queryFn: async () => {
      const { data } = await supabase.from("organisations").select("name").limit(24);
      const names = (data ?? []).map((o) => o.name).filter(Boolean);
      return names.length > 0
        ? names
        : ["Meridian Metals", "Atlas Ferroalloys", "Baltic Ore Partners", "Gulf Commodity Holdings", "Cape Bulk Commodities"];
    },
  });

  const txById = useMemo(() => new Map(txs.map((t) => [t.id, t])), [txs]);

  const { buys, sells, matchedBuys, matchedSells } = useMemo(() => {
    const byTx = new Map<string, BidOfferRow[]>();
    for (const bo of bidOffers) {
      const list = byTx.get(bo.transaction_id) ?? [];
      list.push(bo);
      byTx.set(bo.transaction_id, list);
    }

    const matchedIds = new Set(
      [...byTx.entries()]
        .filter(([, rows]) => rows.some((r) => r.direction === "bid") && rows.some((r) => r.direction !== "bid"))
        .map(([id]) => id),
    );

    const buys: BidOfferRow[] = [];
    const sells: BidOfferRow[] = [];
    const matchedBuys: BidOfferRow[] = [];
    const matchedSells: BidOfferRow[] = [];

    for (const bo of bidOffers) {
      const isBuy = bo.direction === "bid";
      if (matchedIds.has(bo.transaction_id)) {
        (isBuy ? matchedBuys : matchedSells).push(bo);
      } else {
        (isBuy ? buys : sells).push(bo);
      }
    }
    return { buys, sells, matchedBuys, matchedSells };
  }, [bidOffers]);

  function onCreated() {
    void qc.invalidateQueries({ queryKey: ["board-bid-offers"] });
    void qc.invalidateQueries({ queryKey: ["board-txs"] });
  }

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-4 lg:gap-0 lg:divide-x lg:divide-border rounded-2xl border border-border overflow-hidden">
      <Lane
        title="Bid to Buy"
        icon={TrendingUp}
        accentClass="text-primary"
        action={
          <Button size="sm" className="gap-1.5" onClick={() => setDialogDirection("bid")}>
            <Plus className="h-3.5 w-3.5" /> New Bid to Buy
          </Button>
        }
      >
        {buys.length === 0 && <EmptyLane label="No open buy bids" />}
        {buys.map((bo) => (
          <BidCard key={bo.id} bo={bo} tx={txById.get(bo.transaction_id)} tone="neutral" />
        ))}
      </Lane>

      <MatchLane title="Buy Matches" tone="terracotta" matched={matchedBuys} txById={txById} tickerNames={tickerNames} />
      <MatchLane title="Sell Matches" tone="teal" matched={matchedSells} txById={txById} tickerNames={tickerNames} />

      <Lane
        title="Bid to Sell"
        icon={TrendingDown}
        accentClass="text-teal-foreground"
        align="right"
        action={
          <Button
            size="sm"
            className="gap-1.5 bg-[var(--teal)] text-[var(--teal-foreground)] hover:opacity-90"
            onClick={() => setDialogDirection("offer")}
          >
            <Plus className="h-3.5 w-3.5" /> New Bid to Sell
          </Button>
        }
      >
        {sells.length === 0 && <EmptyLane label="No open sell offers" />}
        {sells.map((bo) => (
          <BidCard key={bo.id} bo={bo} tx={txById.get(bo.transaction_id)} tone="neutral" align="right" />
        ))}
      </Lane>

      <BidWizard
        direction={dialogDirection}
        onClose={() => setDialogDirection(null)}
        onCreated={onCreated}
      />
    </div>
  );
}

function Lane({
  title,
  icon: Icon,
  accentClass,
  action,
  align,
  children,
}: {
  title: string;
  icon: typeof TrendingUp;
  accentClass: string;
  action: React.ReactNode;
  align?: "right";
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[420px] flex-col bg-card">
      <div className={cn("flex items-center justify-between gap-2 border-b border-border px-4 py-3", align === "right" && "flex-row-reverse")}>
        <span className={cn("flex items-center gap-1.5 text-sm font-semibold", align === "right" && "flex-row-reverse", accentClass)}>
          <Icon className="h-4 w-4" /> {title}
        </span>
      </div>
      <div className="px-4 py-3">{action}</div>
      <div className="flex-1 space-y-2 overflow-y-auto px-4 pb-4">{children}</div>
    </div>
  );
}

function EmptyLane({ label }: { label: string }) {
  return <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">{label}</p>;
}

function BidCard({
  bo,
  tx,
  tone,
  align,
}: {
  bo: BidOfferRow;
  tx: TxRow | undefined;
  tone: "neutral" | "terracotta" | "teal";
  align?: "right";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3 text-sm",
        tone === "neutral" && "border-border bg-background",
        tone === "terracotta" && "border-[var(--terracotta)]/30 bg-[var(--terracotta)]/10",
        tone === "teal" && "border-[var(--teal)]/30 bg-[var(--teal)]/10",
        align === "right" && "text-right",
      )}
    >
      <p className="truncate font-medium">{tx?.commodity || tx?.title || "Untitled trade"}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {bo.quantity ?? "—"} {bo.unit ?? ""} · {money(bo.price, bo.currency)}
      </p>
    </div>
  );
}

function MatchLane({
  title,
  tone,
  matched,
  txById,
  tickerNames,
}: {
  title: string;
  tone: "terracotta" | "teal";
  matched: BidOfferRow[];
  txById: Map<string, TxRow>;
  tickerNames: string[];
}) {
  const color = tone === "terracotta" ? "var(--terracotta)" : "var(--teal)";
  const colorFg = tone === "terracotta" ? "var(--terracotta-foreground)" : "var(--teal-foreground)";
  const doubled = [...tickerNames, ...tickerNames];

  return (
    <div className="flex min-h-[420px] flex-col bg-muted/20">
      <div className="flex items-center gap-1.5 border-b border-border px-4 py-3">
        <Handshake className="h-4 w-4" style={{ color }} />
        <span className="text-sm font-semibold" style={{ color }}>
          {title}
        </span>
        {matched.length > 0 && (
          <span
            className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ background: color, color: colorFg }}
          >
            {matched.length}
          </span>
        )}
      </div>

      {matched.length > 0 && (
        <div className="space-y-2 border-b border-border px-4 py-3">
          {matched.map((bo) => (
            <BidCard key={bo.id} bo={bo} tx={txById.get(bo.transaction_id)} tone={tone} />
          ))}
        </div>
      )}

      <div className="relative flex-1 overflow-hidden">
        <div className="animate-marquee-up absolute inset-x-0 top-0 space-y-3 px-4" style={{ animationDuration: `${doubled.length * 2.2}s` }}>
          {doubled.map((name, i) => (
            <p key={i} className="truncate text-xs text-muted-foreground/70">
              {name}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
