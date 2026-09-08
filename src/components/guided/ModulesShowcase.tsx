import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useModules } from "@/lib/useModules";
import { cn } from "@/lib/utils";

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
        {modules.map((m) => {
          const active = pathname.startsWith(m.to);
          return (
            <button
              key={m.to}
              type="button"
              onClick={() => navigate({ to: m.to })}
              className={cn(
                "group relative min-w-0 flex-1 overflow-hidden rounded-2xl bg-primary px-3.5 py-3 text-left text-primary-foreground shadow-[var(--glass-shadow)] transition-transform hover:-translate-y-0.5",
                active && "ring-2 ring-primary-foreground/50",
              )}
            >
              <span className="pointer-events-none absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/15" />
              <span className="relative flex items-center gap-2">
                <m.icon className="h-3.5 w-3.5 shrink-0" />
                <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold tracking-tight">
                  {m.label}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
