import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
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

/** Self-service — any signed-in user can issue and manage keys for their own org. Signed-out
 * visitors never reach this component: the _authenticated layout redirects them to sign in first. */
function ApiPage() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <AppShell title="API">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </AppShell>
    );
  }

  return (
    <AppShell title="API" description="Issue and manage API keys for integrating with the Izenzo gateway.">
      <ApiKeysTab />
    </AppShell>
  );
}
