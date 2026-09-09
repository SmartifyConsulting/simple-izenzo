import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { when } from "@/lib/tx";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/activity")({
  head: () => ({
    meta: [
      { title: "Activity Log — Izenzo" },
      { name: "description", content: "Your own recent activity on Izenzo." },
    ],
  }),
  component: ActivityPage,
});

type ActivityRow = {
  id: string;
  event_type: string;
  label: string | null;
  path: string | null;
  created_at: string;
};

const activityLog = supabase as unknown as {
  from(table: "user_activity_log"): {
    select(cols: string): {
      eq(col: string, val: string): {
        order(col: string, opts: { ascending: boolean }): {
          limit(n: number): Promise<{ data: ActivityRow[] | null; error: { message: string } | null }>;
        };
      };
    };
  };
};

function ActivityPage() {
  const { user } = useAuth();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["my-activity-log", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await activityLog
        .from("user_activity_log")
        .select("id, event_type, label, path, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  return (
    <AppShell pureBlack title="Activity Log" description="Your own recent activity on Izenzo">
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No activity recorded yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <Badge
                      variant="outline"
                      className={cn(
                        "font-normal border-transparent",
                        r.event_type === "navigation" ? "bg-info/15 text-info" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {r.event_type}
                    </Badge>
                    <span className="truncate">{r.label ?? r.path ?? "—"}</span>
                  </p>
                  {r.path && <p className="mt-0.5 truncate text-xs text-muted-foreground">{r.path}</p>}
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{when(r.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
