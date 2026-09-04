import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { money, when, type Transaction } from "@/lib/tx";

export const Route = createFileRoute("/_authenticated/inbox")({
  head: () => ({
    meta: [
      { title: "Counterparty inbox — Izenzo" },
      {
        name: "description",
        content: "Transactions where your organisation sits on the other side of the table.",
      },
      { property: "og:title", content: "Counterparty inbox — Izenzo" },
      {
        property: "og:description",
        content: "Transactions where your organisation is the counterparty.",
      },
    ],
  }),
  component: InboxPage,
});

function InboxPage() {
  const { org } = useAuth();

  const { data: txs = [], isLoading } = useQuery({
    queryKey: ["inbox", org?.id],
    enabled: Boolean(org?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("counterparty_org_id", org!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Transaction[];
    },
  });

  return (
    <AppShell title="Counterparty inbox" description="Where you are on the other side">
      <div className="overflow-hidden rounded-md border border-border">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : txs.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            Nothing has been sent to your organisation as counterparty yet.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {txs.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="text-sm font-medium">{t.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {money(t.price, t.currency)} · opened {when(t.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="font-normal capitalize">
                    {t.stage}
                  </Badge>
                  <Link
                    to="/tx/$id/$stage/$step"
                    params={{ id: t.id, stage: t.stage, step: t.step }}
                  >
                    <Button size="sm" variant="outline">
                      Open
                    </Button>
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
