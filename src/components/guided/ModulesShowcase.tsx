import { useNavigate, useRouterState } from "@tanstack/react-router";
import { CanvasNode } from "@/components/canvas/CanvasNode";
import { useModules } from "@/lib/useModules";

/** The classic shell's Modules grid, copied inline onto Simple Mode (rather than tucked behind
 * a dialog) so every module is visible at once while deciding how each one folds into the
 * simplified board. Purely a reference/staging area for now — nothing here is wired differently
 * from the classic Modules launcher. */
export function ModulesShowcase() {
  const modules = useModules();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  return (
    <section className="mt-8">
      <p className="label-caps">All modules</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Everything available in the classic layout, laid out here to plan how each folds into
        Simple Mode.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((m, i) => (
          <CanvasNode
            key={m.to}
            label={m.label}
            blurb={m.blurb}
            icon={m.icon}
            state={pathname.startsWith(m.to) ? "active" : "open"}
            delay={i * 60}
            onClick={() => navigate({ to: m.to })}
          />
        ))}
      </div>
    </section>
  );
}
