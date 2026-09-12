import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { DeveloperShell } from "@/components/layout/DeveloperShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/developer/notifications")({
  head: () => ({
    meta: [{ title: "Notifications — Developer Centre" }],
  }),
  component: DevNotificationsPage,
});

function DevNotificationsPage() {
  const { user } = useAuth();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["dev-notifications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <DeveloperShell title="Notifications" description="Platform-level alerts for this workspace.">
      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : notifications.length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-800 p-8 text-center">
          <Bell className="mx-auto h-5 w-5 text-slate-600" />
          <p className="mt-2 text-sm text-slate-400">You're all caught up.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <div key={n.id} className="rounded-md border border-slate-800 bg-slate-900 p-3">
              <p className="text-sm font-medium text-slate-100">{n.title}</p>
              <p className="mt-0.5 text-xs text-slate-400">{n.body}</p>
              <p className="mt-1 text-[11px] text-slate-600">{new Date(n.created_at).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}
    </DeveloperShell>
  );
}
