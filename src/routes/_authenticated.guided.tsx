import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { CanvasNode, Connector } from "@/components/canvas/CanvasNode";
import { NAV_DESTINATIONS } from "@/lib/navDestinations";

export const Route = createFileRoute("/_authenticated/guided")({
  head: () => ({
    meta: [{ title: "Simple Mode — Izenzo" }],
  }),
  component: Guided,
});

/** The simplified, icon-driven counterpart to the detailed sidebar nav — same destinations
 * (see src/lib/navDestinations.ts), presented as one guided animated flow instead of a list,
 * for showing the client two navigation styles side by side. */
function Guided() {
  const navigate = useNavigate();

  return (
    <AppShell
      title="Simple Mode"
      description="Everything on the Trading Gateway, one guided step at a time."
    >
      <div className="ink-grid mx-auto max-w-md rounded-3xl border border-border p-5 sm:p-7">
        {NAV_DESTINATIONS.map((item, i) => (
          <div key={item.label}>
            <CanvasNode
              label={item.label}
              blurb={item.blurb}
              state="open"
              icon={item.icon}
              side="center"
              delay={i * 80}
              onClick={() => navigate({ to: item.to })}
            />
            {i < NAV_DESTINATIONS.length - 1 && <Connector />}
          </div>
        ))}
      </div>
    </AppShell>
  );
}
