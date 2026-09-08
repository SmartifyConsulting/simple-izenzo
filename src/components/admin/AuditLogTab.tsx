import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type ActivityRow = {
  id: string;
  user_id: string;
  event_type: "click" | "navigation";
  label: string | null;
  path: string;
  occurred_at: string;
};

type ProfileLite = { id: string; email: string | null; full_name: string | null };

/**
 * user_activity_log isn't in the generated Supabase types until the next `types.ts`
 * regeneration picks up the migration, so these reads go through an untyped client.
 */
const activityLog = supabase as unknown as {
  from(table: "user_activity_log"): {
    select(cols: string): {
      order(col: string, opts: { ascending: boolean }): {
        limit(n: number): Promise<{ data: ActivityRow[] | null; error: { message: string } | null }>;
      };
    };
  };
};

export function AuditLogTab({ initialUserId }: { initialUserId?: string | undefined } = {}) {
  const [userFilter, setUserFilter] = useState(initialUserId ?? "all");
  const [search, setSearch] = useState("");

  const { data: users = [] } = useQuery({
    queryKey: ["admin-users-lite"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, email, full_name");
      if (error) throw error;
      return (data ?? []) as ProfileLite[];
    },
  });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-activity-log"],
    queryFn: async () => {
      const { data, error } = await activityLog
        .from("user_activity_log")
        .select("id, user_id, event_type, label, path, occurred_at")
        .order("occurred_at", { ascending: false })
        .limit(1000);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const byUser = new Map(users.map((u) => [u.id, u]));
  const q = search.trim().toLowerCase();

  const filtered = rows.filter((r) => {
    if (userFilter !== "all" && r.user_id !== userFilter) return false;
    if (!q) return true;
    const who = byUser.get(r.user_id);
    return (
      (who?.full_name ?? "").toLowerCase().includes(q) ||
      (who?.email ?? "").toLowerCase().includes(q) ||
      (r.label ?? "").toLowerCase().includes(q) ||
      r.path.toLowerCase().includes(q)
    );
  });

  const filteredUser = userFilter !== "all" ? byUser.get(userFilter) : undefined;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search by user, label or path…"
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
                  <th className="px-4 py-2 font-medium">Event</th>
                  <th className="px-4 py-2 font-medium">Detail</th>
                  <th className="px-4 py-2 font-medium">Page</th>
                  <th className="px-4 py-2 font-medium">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((r) => {
                  const who = byUser.get(r.user_id);
                  return (
                    <tr key={r.id}>
                      <td className="whitespace-nowrap px-4 py-2">{who?.full_name ?? who?.email ?? r.user_id}</td>
                      <td className="px-4 py-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            "font-normal border-transparent",
                            r.event_type === "navigation"
                              ? "bg-info/15 text-info"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          {r.event_type}
                        </Badge>
                      </td>
                      <td className="max-w-xs truncate px-4 py-2 text-muted-foreground">{r.label ?? "—"}</td>
                      <td className="max-w-xs truncate px-4 py-2 font-mono text-xs text-muted-foreground">
                        {r.path}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-muted-foreground">
                        {new Date(r.occurred_at).toLocaleString()}
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
