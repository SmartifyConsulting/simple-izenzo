import type { ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  KeyRound,
  Activity,
  LifeBuoy,
  Webhook,
  Database,
  BookOpen,
  Bell,
  ArrowLeftRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { ProfileAvatarMenu } from "@/components/guided/ProfileAvatarMenu";
import { SiteFooter } from "@/components/layout/SiteFooter";

const NAV = [
  { to: "/developer/keys", label: "API Keys", icon: KeyRound },
  { to: "/developer/usage", label: "API Usage", icon: Activity },
  { to: "/developer/support", label: "API Support", icon: LifeBuoy },
  { to: "/developer/webhooks", label: "Webhook Logs", icon: Webhook },
  { to: "/developer/schema", label: "Schema Explorer", icon: Database },
  { to: "/developer/docs", label: "Integration Docs", icon: BookOpen },
  { to: "/developer/notifications", label: "Notifications", icon: Bell },
] as const;

/** The Developer Centre workspace — deliberately a different visual language (dark, monospace,
 * command-console) from the rest of the light-themed app, mirroring the reference site's own
 * Developer Centre. Governs API keys, usage, webhook logs and integration docs. */
export function DeveloperShell({
  title,
  description,
  actions,
  children,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { org } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="flex min-h-screen bg-slate-950 font-mono text-slate-200">
      <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-slate-800 bg-slate-900">
        <div className="border-b border-slate-800 px-4 py-4">
          <p className="text-[10px] uppercase tracking-[0.15em] text-emerald-400">Izenzo / Dev</p>
          <p className="mt-0.5 text-sm font-semibold text-slate-100">Command Centre</p>
        </div>

        <div className="border-b border-slate-800 px-4 py-3">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Workspace</p>
          <p className="truncate text-sm font-medium text-slate-200">Developer Centre</p>
          <p className="truncate text-[11px] text-slate-500">{org?.name ?? "—"}</p>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
          {NAV.map((item) => {
            const active = pathname === item.to || pathname.startsWith(item.to + "/");
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                  active
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}

          <div className="my-3 border-t border-slate-800" />

          <button
            onClick={() => navigate({ to: "/dashboard" })}
            className="flex w-full items-center gap-2.5 rounded-md border border-slate-800 px-2.5 py-2 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
          >
            <ArrowLeftRight className="h-4 w-4" />
            Switch to Trade Desk
          </button>
        </nav>

        <div className="border-t border-slate-800 px-4 py-3">
          <ProfileAvatarMenu />
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-8 py-8">
        {(title || description || actions) && (
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              {title && <h1 className="text-xl font-semibold tracking-tight text-slate-100">{title}</h1>}
              {description && <p className="mt-1 text-sm text-slate-400">{description}</p>}
            </div>
            {actions}
          </div>
        )}
        {children}
        <SiteFooter />

      </main>
    </div>
  );
}
