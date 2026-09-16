import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

/** One line of the log, whatever it came from — a click/navigation in the app, or a recorded
 * workflow event on a bid (registration, upload, search, choice, intent, POI, WaD, execution…). */
type LogRow = {
  id: string;
  user_id: string;
  event_type: string;
  label: string | null;
  path: string | null;
  created_at: string;
  transaction_id: string | null;
};

type ProfileLite = { id: string; email: string | null; full_name: string | null };
type DealLite = { id: string; reference: string | null; title: string | null };

const untyped = supabase as unknown as {
  from(table: string): {
    select(cols: string): {
      order(
        col: string,
        opts: { ascending: boolean },
      ): {
        limit(n: number): Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>;
      };
    };
  };
};

export function AuditLogTab({ initialUserId }: { initialUserId?: string | undefined } = {}) {
  const [userFilter, setUserFilter] = useState(initialUserId ?? "all");
  const [bidFilter, setBidFilter] = useState("all");
  const [search, setSearch] = useState("");

  const { data: users = [] } = useQuery({
    queryKey: ["admin-users-lite"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, email, full_name");
      if (error) throw error;
      return (data ?? []) as ProfileLite[];
    },
  });

  // Every bid ever created, so the log can be read one BID at a time.
  const { data: deals = [] } = useQuery({
    queryKey: ["admin-deals-lite"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("id, reference, title")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as DealLite[];
    },
  });

  // Two sources, one list: app activity (clicks/navigation) and the workflow events already
  // recorded against each bid — so nothing a person did on a bid is missing from this view.
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-activity-log"],
    queryFn: async (): Promise<LogRow[]> => {
      const [appLog, dealLog] = await Promise.all([
        untyped
          .from("user_activity_log")
          .select("id, user_id, event_type, label, path, created_at, transaction_id")
          .order("created_at", { ascending: false })
          .limit(1000),
        untyped
          .from("transaction_events")
          .select("id, actor_id, action, summary, stage, step, transaction_id, created_at")
          .order("created_at", { ascending: false })
          .limit(1000),
      ]);
      if (appLog.error) throw new Error(appLog.error.message);
      if (dealLog.error) throw new Error(dealLog.error.message);

      const app: LogRow[] = (appLog.data ?? []).map((r) => ({
        id: `a:${String(r["id"])}`,
        user_id: String(r["user_id"] ?? ""),
        event_type: String(r["event_type"] ?? "click"),
        label: (r["label"] as string | null) ?? null,
        path: (r["path"] as string | null) ?? null,
        created_at: String(r["created_at"]),
        transaction_id: (r["transaction_id"] as string | null) ?? null,
      }));

      const deal: LogRow[] = (dealLog.data ?? []).map((r) => ({
        id: `e:${String(r["id"])}`,
        user_id: String(r["actor_id"] ?? ""),
        event_type: String(r["action"] ?? "event"),
        label: (r["summary"] as string | null) ?? null,
        path: [r["stage"], r["step"]].filter(Boolean).join(" / ") || null,
        created_at: String(r["created_at"]),
        transaction_id: (r["transaction_id"] as string | null) ?? null,
      }));

      return [...app, ...deal].sort((a, b) => b.created_at.localeCompare(a.created_at));
    },
  });

  const byUser = new Map(users.map((u) => [u.id, u]));
  const byDeal = new Map(deals.map((d) => [d.id, d]));
  const q = search.trim().toLowerCase();

  const filtered = rows.filter((r) => {
    if (userFilter !== "all" && r.user_id !== userFilter) return false;
    if (bidFilter !== "all" && r.transaction_id !== bidFilter) return false;
    if (!q) return true;
    const who = byUser.get(r.user_id);
    const deal = r.transaction_id ? byDeal.get(r.transaction_id) : undefined;
    return (
      (who?.full_name ?? "").toLowerCase().includes(q) ||
      (who?.email ?? "").toLowerCase().includes(q) ||
      (r.label ?? "").toLowerCase().includes(q) ||
      (r.event_type ?? "").toLowerCase().includes(q) ||
      (deal?.reference ?? "").toLowerCase().includes(q) ||
      (deal?.title ?? "").toLowerCase().includes(q) ||
      (r.path ?? "").toLowerCase().includes(q)
    );
  });

  const filteredUser = userFilter !== "all" ? byUser.get(userFilter) : undefined;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search by user, BID, action or page…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <select
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          aria-label="Filter by user"
        >
          <option value="all">All users</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.full_name ?? u.email ?? u.id}
            </option>
          ))}
        </select>
        <select
          value={bidFilter}
          onChange={(e) => setBidFilter(e.target.value)}
          className="h-9 max-w-[16rem] rounded-md border border-input bg-background px-3 text-sm"
          aria-label="Filter by bid"
        >
          <option value="all">All bids</option>
          {deals.map((d) => (
            <option key={d.id} value={d.id}>
              {d.reference ?? d.id.slice(0, 8)}
              {d.title ? ` — ${d.title}` : ""}
            </option>
          ))}
        </select>
        {filteredUser && (
          <Badge variant="outline" className="font-normal">
            Showing: {filteredUser.full_name ?? filteredUser.email}
          </Badge>
        )}
      </div>

      <div className="overflow-hidden rounded-md border border-border">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No activity recorded yet.</p>
        ) : (
          <div className="max-h-[32rem] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 border-b border-border bg-muted/50 text-left">
                <tr>
                  <th className="px-4 py-2 font-medium">User</th>
                  <th className="px-4 py-2 font-medium">BID</th>
                  <th className="px-4 py-2 font-medium">Event</th>
                  <th className="px-4 py-2 font-medium">Detail</th>
                  <th className="px-4 py-2 font-medium">Page</th>
                  <th className="px-4 py-2 font-medium">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((r) => {
                  const who = byUser.get(r.user_id);
                  const deal = r.transaction_id ? byDeal.get(r.transaction_id) : undefined;
                  return (
                    <tr key={r.id}>
                      <td className="whitespace-nowrap px-4 py-2">{who?.full_name ?? who?.email ?? r.user_id}</td>
                      <td className="whitespace-nowrap px-4 py-2 font-mono text-xs">
                        {deal?.reference ?? (r.transaction_id ? r.transaction_id.slice(0, 8) : "—")}
                      </td>
                      <td className="px-4 py-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            "font-normal border-transparent",
                            r.event_type === "navigation"
                              ? "bg-info/15 text-info"
                              : r.event_type === "click"
                                ? "bg-muted text-muted-foreground"
                                : "bg-success/15 text-success",
                          )}
                        >
                          {r.event_type}
                        </Badge>
                      </td>
                      <td className="max-w-xs truncate px-4 py-2 text-muted-foreground">{r.label ?? "—"}</td>
                      <td className="max-w-xs truncate px-4 py-2 font-mono text-xs text-muted-foreground">
                        {r.path ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-muted-foreground">
                        {new Date(r.created_at).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
