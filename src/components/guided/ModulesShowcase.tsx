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
      <div className="flex gap-2">
        {modules.map((m, i) => (
          <div key={m.to} className="min-w-0 flex-1">
            <CanvasNode
              label={m.label}
              icon={m.icon}
              state={pathname.startsWith(m.to) ? "active" : "open"}
              delay={i * 60}
              compact
              onClick={() => navigate({ to: m.to })}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
