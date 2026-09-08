import type { ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Inbox, FileSearch, ShieldCheck, Activity, Bell, LogOut, ArrowLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/Logo";

const NAV = [
  { to: "/governance/triage", label: "Triage Queue", icon: Inbox },
  { to: "/governance/audits", label: "Active Audits", icon: FileSearch },
  { to: "/governance/entities", label: "Entity Verification", icon: ShieldCheck },
  { to: "/governance/health", label: "System Health", icon: Activity },
  { to: "/governance/notifications", label: "Notifications", icon: Bell },
] as const;

/** The Governance Console workspace — compliance officers triage disputes, run audits, and
 * verify entities. Read from the same compliance_cases / counterparties / settlement_mismatches
 * tables the Trade Desk already writes to, scoped by the same RLS everything else uses (no
 * separate cross-org bypass has been built, so this shows what the signed-in account can see). */
export function GovernanceShell({
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
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-sidebar">
        <div className="border-b border-border px-4 py-4">
          <Logo className="h-6" />
        </div>

        <div className="border-b border-border px-4 py-3">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Workspace</p>
          <p className="truncate text-sm font-semibold">Governance Console</p>
          <p className="text-xs text-muted-foreground">Triage &amp; adjudicate</p>
        </div>

        <nav className="flex-1 space-y-0.5 px-2 py-3">
          {NAV.map((item) => {
            const active = pathname === item.to || pathname.startsWith(item.to + "/");
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}

          <div className="my-3 border-t border-border" />

          <button
            onClick={() => navigate({ to: "/dashboard" })}
            className="flex w-full items-center gap-2.5 rounded-md border border-border px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ArrowLeftRight className="h-4 w-4" />
            Switch to Trade Desk
          </button>
        </nav>

        <div className="border-t border-border px-4 py-3">
          <p className="truncate text-xs text-muted-foreground">{profile?.email}</p>
          <button
            className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={async () => {
              await signOut();
              navigate({ to: "/" });
            }}
          >
            <LogOut className="h-3 w-3" /> Sign out
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-8 py-8">
        {(title || description || actions) && (
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              {title && <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>}
              {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
            </div>
            {actions}
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
