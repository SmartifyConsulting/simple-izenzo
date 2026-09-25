import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { tradeKindOf, when } from "@/lib/tx";

/** Monday-based week start, at midnight local time — used to group notifications by week and to
 * tell "this week" apart from every other one. */
function startOfWeek(d: Date): Date {
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day; // shift Sunday (0) to the previous Monday
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  return start;
}
function weekKey(d: Date): string {
  return startOfWeek(d).toISOString().slice(0, 10);
}
function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y!, m! - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}
function weekLabel(key: string): string {
  const start = new Date(`${key}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  return `Week of ${fmt(start)} – ${fmt(end)}`;
}


export const Route = createFileRoute("/_authenticated/inbox")({
  head: () => ({
    meta: [
      { title: "Inbox — Izenzo" },
      {
        name: "description",
        content: "Notifications about deals your organisation is part of.",
      },
      { property: "og:title", content: "Inbox — Izenzo" },
      {
        property: "og:description",
        content: "Notifications about deals your organisation is part of.",
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
  claim_counterparty_id: string | null;
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
        .select("id, title, body, read, created_at, transaction_id, claim_counterparty_id")
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
  async function markUnread(id: string) {
    await supabase.from("notifications").update({ read: false }).eq("id", id);
    await queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }

  // Read notifications move out of the Inbox tab into Archive — Mark Read is the only way in,
  // Restore (in Archive) is the only way back out.
  const [tab, setTab] = useState<"inbox" | "archive">("inbox");
  const archiveCount = notifications.filter((n) => n.read).length;
  const inboxCount = notifications.length - archiveCount;
  const visibleNotifications = notifications.filter((n) => (tab === "archive" ? n.read : !n.read));

  // Grouped month → week, most recent first. Every group collapses by default except the one
  // holding the current week — that's the only history anyone needs open on arrival.
  const thisWeekKey = weekKey(new Date());
  const thisMonthKey = monthKey(new Date());
  const monthGroups = new Map<string, Map<string, NotificationRow[]>>();
  for (const n of visibleNotifications) {
    const created = new Date(n.created_at);
    const mKey = monthKey(created);
    const wKey = weekKey(created);
    if (!monthGroups.has(mKey)) monthGroups.set(mKey, new Map());
    const weeks = monthGroups.get(mKey)!;
    if (!weeks.has(wKey)) weeks.set(wKey, []);
    weeks.get(wKey)!.push(n);
  }
  const orderedMonths = [...monthGroups.keys()].sort().reverse();

  const [openMonths, setOpenMonths] = useState<Set<string>>(() => new Set([thisMonthKey]));
  const [openWeeks, setOpenWeeks] = useState<Set<string>>(() => new Set([thisWeekKey]));
  function toggleMonth(key: string) {
    setOpenMonths((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }
  function toggleWeek(key: string) {
    setOpenWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <AppShell title="Inbox" description="Updates on deals you're part of">
      {notifications.length > 0 && (
        <div className="mb-4 overflow-hidden rounded-md border border-border">
          <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/30 px-4 py-2">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Notifications</p>
            <div className="flex items-center gap-1">
              {(
                [
                  ["inbox", "Inbox", inboxCount],
                  ["archive", "Archive", archiveCount],
                ] as const
              ).map(([key, label, count]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={tab === key}
                  onClick={() => setTab(key)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                    tab === key
                      ? "border-transparent bg-foreground text-background"
                      : "border-border bg-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                  {count > 0 && <span className="text-[10px] opacity-80">{count}</span>}
                </button>
              ))}
            </div>
          </div>
          <div className="divide-y divide-border">
            {visibleNotifications.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                {tab === "archive" ? "Nothing archived yet — notifications land here once marked read." : "You're all caught up."}
              </p>
            ) : (
              orderedMonths.map((mKey) => {
              const weeks = monthGroups.get(mKey)!;
              const orderedWeeks = [...weeks.keys()].sort().reverse();
              const monthOpen = openMonths.has(mKey);
              const monthUnread = [...weeks.values()].flat().filter((n) => !n.read).length;
              return (
                <div key={mKey}>
                  <button
                    type="button"
                    onClick={() => toggleMonth(mKey)}
                    aria-expanded={monthOpen}
                    className="flex w-full items-center justify-between gap-2 bg-muted/10 px-4 py-2 text-left hover:bg-muted/20"
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      {monthLabel(mKey)}
                      {monthUnread > 0 && (
                        <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                          {monthUnread}
                        </span>
                      )}
                    </span>
                    <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", monthOpen && "rotate-180")} />
                  </button>
                  {monthOpen && (
                    <div className="divide-y divide-border">
                      {orderedWeeks.map((wKey) => {
                        const items = weeks.get(wKey)!;
                        const weekOpen = openWeeks.has(wKey);
                        const isCurrentWeek = wKey === thisWeekKey;
                        const weekUnread = items.filter((n) => !n.read).length;
                        return (
                          <div key={wKey}>
                            <button
                              type="button"
                              onClick={() => toggleWeek(wKey)}
                              aria-expanded={weekOpen}
                              className="flex w-full items-center justify-between gap-2 px-4 py-1.5 pl-7 text-left hover:bg-muted/10"
                            >
                              <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                                {isCurrentWeek ? "This week" : weekLabel(wKey)}
                                {weekUnread > 0 && (
                                  <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                                    {weekUnread}
                                  </span>
                                )}
                              </span>
                              <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", weekOpen && "rotate-180")} />
                            </button>
                            {weekOpen && (
                              <ul className="divide-y divide-border">
                                {items.map((n) => {
                                  const reference = n.transaction_id ? referenceById[n.transaction_id] : null;
                                  return (
                                    <li
                                      key={n.id}
                                      className={cn(
                                        "flex items-center justify-between gap-3 p-4",
                                        !n.read && "bg-primary/5",
                                      )}
                                    >
                                      <div className="flex min-w-0 flex-1 items-start gap-2">
                                        {/* A plain dot instead of a "New" badge — the word next to a
                                            title that already says what happened read as a second,
                                            confusing label rather than a status. */}
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
                                              n.claim_counterparty_id ? (
                                                <Link
                                                  to="/counterparty/claim"
                                                  search={{ cp: n.claim_counterparty_id }}
                                                  onClick={() => void markRead(n.id)}
                                                  className={cn(
                                                    "shrink-0 font-mono text-xs font-normal underline-offset-2 hover:underline",
                                                    tradeKindOf(reference) === "bid"
                                                      ? "theme-light:text-success text-[#00e676]"
                                                      : tradeKindOf(reference) === "offer"
                                                        ? "text-[#4169e1]"
                                                        : "text-primary",
                                                  )}
                                                >
                                                  {reference}
                                                </Link>
                                              ) : (
                                                <Link
                                                  to="/live-deal-engine"
                                                  search={{ tx: n.transaction_id }}
                                                  onClick={() => void markRead(n.id)}
                                                  className={cn(
                                                    "shrink-0 font-mono text-xs font-normal underline-offset-2 hover:underline",
                                                    // Same Bid=green / Offer=blue convention as the
                                                    // workspace taskbar and registration pill, so a
                                                    // reference reads the same way everywhere.
                                                    tradeKindOf(reference) === "bid"
                                                      ? "theme-light:text-success text-[#00e676]"
                                                      : tradeKindOf(reference) === "offer"
                                                        ? "text-[#4169e1]"
                                                        : "text-primary",
                                                  )}
                                                >
                                                  {reference}
                                                </Link>
                                              )
                                            )}
                                            {/* The title's own BID/OFF id is baked into its text
                                                server-side, so it needs to be clickable even when
                                                the reference lookup above comes back empty (older
                                                rows, or the reference column not yet on this row)
                                                — the whole title links through whenever the
                                                notification has a transaction at all. Coloured on
                                                the same Bid=green / Offer=blue convention as the
                                                reference above it, so a notification about a bid or
                                                an offer reads at a glance. */}
                                            {n.claim_counterparty_id ? (
                                              <Link
                                                to="/counterparty/claim"
                                                search={{ cp: n.claim_counterparty_id }}
                                                onClick={() => void markRead(n.id)}
                                                className={cn(
                                                  "text-sm hover:underline",
                                                  n.read ? "font-medium" : "font-semibold",
                                                  reference && tradeKindOf(reference) === "bid"
                                                    ? "theme-light:text-success text-[#00e676]"
                                                    : reference && tradeKindOf(reference) === "offer"
                                                      ? "text-[#4169e1]"
                                                      : "text-foreground",
                                                )}
                                              >
                                                {n.title}
                                              </Link>
                                            ) : n.transaction_id ? (
                                              <Link
                                                to="/live-deal-engine"
                                                search={{ tx: n.transaction_id }}
                                                onClick={() => void markRead(n.id)}
                                                className={cn(
                                                  "text-sm hover:underline",
                                                  n.read ? "font-medium" : "font-semibold",
                                                  reference && tradeKindOf(reference) === "bid"
                                                    ? "theme-light:text-success text-[#00e676]"
                                                    : reference && tradeKindOf(reference) === "offer"
                                                      ? "text-[#4169e1]"
                                                      : "text-foreground",
                                                )}
                                              >
                                                {n.title}
                                              </Link>
                                            ) : (
                                              <p className={cn("text-sm", n.read ? "font-medium" : "font-semibold")}>
                                                {n.title}
                                              </p>
                                            )}
                                          </div>
                                          {n.body && <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>}
                                          <p className="mt-0.5 text-xs text-muted-foreground">{when(n.created_at)}</p>
                                        </div>
                                      </div>
                                      {/* shrink-0 + ml-auto: this stays pinned to the row's far right
                                          even when the title/body on the left wraps onto several
                                          lines, instead of ever dropping down or drifting inward. */}
                                      <div className="ml-auto flex shrink-0 items-center gap-2">
                                        {tab === "archive" ? (
                                          <Button size="sm" variant="outline" onClick={() => void markUnread(n.id)}>
                                            Restore
                                          </Button>
                                        ) : (
                                          !n.read && (
                                            <Button size="sm" variant="outline" onClick={() => void markRead(n.id)}>
                                              Mark read
                                            </Button>
                                          )
                                        )}
                                      </div>
                                    </li>
                                  );
                                })}
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
      )}
    </AppShell>
  );
}
