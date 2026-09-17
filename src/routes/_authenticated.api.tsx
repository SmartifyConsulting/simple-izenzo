import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { ApiKeysTab } from "@/components/admin/ApiKeysTab";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/api")({
  head: () => ({
    meta: [
      { title: "API Keys — Izenzo" },
      { name: "description", content: "Issue and manage API keys for integrating with the Izenzo gateway." },
    ],
  }),
  component: ApiPage,
});

/** Same admin-only bar as the Admin area, since issuing an API key is exactly as sensitive as
 * anything gated there — this is just a shorter path to it than Admin > API Keys. */
function ApiPage() {
  const { roles, loading, refresh } = useAuth();
  const isAdmin = roles.includes("admin");
  const [rechecking, setRechecking] = useState(false);

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <AppShell title="API">
        <p className="text-sm text-muted-foreground">Checking your access…</p>
      </AppShell>
    );
  }

  if (!isAdmin) {
    return (
      <AppShell title="API">
        <p className="text-sm text-muted-foreground">
          This area is for administrators. Your seat does not have that role.
        </p>
        <Button
          className="mt-4"
          variant="outline"
          disabled={rechecking}
          onClick={() => {
            setRechecking(true);
            void refresh().finally(() => setRechecking(false));
          }}
        >
          {rechecking ? "Rechecking…" : "Recheck my access"}
        </Button>
      </AppShell>
    );
  }

  return (
    <AppShell title="API" description="Issue and manage API keys for integrating with the Izenzo gateway.">
      <ApiKeysTab />
    </AppShell>
  );
}
