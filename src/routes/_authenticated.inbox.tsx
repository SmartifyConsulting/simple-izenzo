import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { money, when, type Transaction } from "@/lib/tx";


export const Route = createFileRoute("/_authenticated/inbox")({
  head: () => ({
    meta: [
      { title: "Inbox — Izenzo" },
      {
        name: "description",
        content: "Transactions where your organisation sits on the other side of the table.",
      },
      { property: "og:title", content: "Inbox — Izenzo" },
      {
        property: "og:description",
        content: "Transactions where your organisation is the counterparty.",
      },
    ],
  }),
  component: InboxPage,
});

type NotificationRow = {
  id: string;
  title: string;
  body: string | null;
  read: boolean;
  created_at: string;
  transaction_id: string | null;
};

function InboxPage() {
  const { org } = useAuth();
  const queryClient = useQueryClient();

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", org?.id],
    enabled: Boolean(org?.id),
    queryFn: async () => {
      // Scoped to the organisation actually being viewed — without this, RLS alone decides what
      // comes back, and an account that belongs to more than one organisation (a bidder account
      // that's also a member of a counterparty org, say) saw every one of those orgs' notifications
      // combined into a single list: a "Smartify has been emailed" row addressed to the bidder
      // sitting right next to a "you've been matched" row addressed to Smartify itself, as if one
      // company had received both.
      const { data, error } = await supabase
        .from("notifications")
        .select("id, title, body, read, created_at, transaction_id")
        .eq("org_id", org!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as NotificationRow[];
    },
  });

  // The Bid/Offer reference (e.g. "BID1655539"), so it can be shown as a clickable link on each
  // notification instead of a separate "Open" button — fetched separately from `notifications`
  // itself since there's no declared foreign-key relationship to embed it on that select.
  const txIds = [...new Set(notifications.map((n) => n.transaction_id).filter((id): id is string => Boolean(id)))];
  const { data: referenceById = {} } = useQuery({
    queryKey: ["notification-tx-references", txIds.join(",")],
    enabled: txIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("transactions").select("id, reference").in("id", txIds);
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((t) => [t.id, t.reference as string | null]));
    },
  });

  async function markRead(id: string) {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    await queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }

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
    <AppShell title="Inbox" description="Where you are on the other side">
      {notifications.length > 0 && (
        <div className="mb-4 overflow-hidden rounded-md border border-border">
          <p className="border-b border-border bg-muted/30 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Notifications
          </p>
          <ul className="divide-y divide-border">
            {notifications.map((n) => {
              const reference = n.transaction_id ? referenceById[n.transaction_id] : null;
              return (
              <li
                key={n.id}
                className={cn(
                  "flex flex-wrap items-center justify-between gap-3 p-4",
                  !n.read && "bg-primary/5",
                )}
              >
                <div className="flex min-w-0 items-start gap-2">
                  {/* A plain dot instead of a "New" badge — the word next to a title that already
                      says what happened read as a second, confusing label rather than a status. */}
                  <span
                    aria-label={n.read ? undefined : "Unread"}
                    className={cn(
                      "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                      n.read ? "bg-transparent" : "bg-foreground",
                    )}
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {reference && n.transaction_id && (
                        <Link
                          to="/live-deal-engine"
                          search={{ tx: n.transaction_id }}
                          onClick={() => void markRead(n.id)}
                          className="shrink-0 font-mono text-xs font-bold text-primary underline-offset-2 hover:underline"
                        >
                          {reference}
                        </Link>
                      )}
                      <p className={cn("text-sm", n.read ? "font-medium" : "font-semibold")}>
                        {n.title}
                      </p>
                    </div>
                    {n.body && <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>}
                    <p className="mt-0.5 text-xs text-muted-foreground">{when(n.created_at)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!n.read && (
                    <Button size="sm" variant="outline" onClick={() => void markRead(n.id)}>
                      Mark read
                    </Button>
                  )}
                </div>
              </li>
              );
            })}
          </ul>
        </div>
      )}

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
