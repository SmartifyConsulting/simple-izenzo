import { type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { ChevronDown, Waypoints, ArrowLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { setLayoutPreference } from "@/lib/layoutPreference";
import { NAV_DESTINATIONS } from "@/lib/navDestinations";
import { WorkspaceSwitcher } from "@/components/layout/WorkspaceSwitcher";
import { ProfileAvatarMenu } from "@/components/guided/ProfileAvatarMenu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function SidebarShell({
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
  const { profile, org } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isSimpleMode = pathname === "/guided" || pathname.startsWith("/guided/");

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-sidebar">
        <div className="flex items-center justify-between border-b border-border px-4 py-4">
          <Logo className="h-6" />
          <LayoutSwitch />
        </div>

        <div className="border-b border-border p-2">
          <WorkspaceSwitcher current={org?.name ?? "Trade Desk"} />
        </div>

        <nav className="flex-1 space-y-0.5 px-2 py-3">
          {isSimpleMode ? (
            <>
              <Link
                to="/guided"
                className="flex items-center gap-2.5 rounded-md bg-primary/10 px-2.5 py-2 text-sm font-semibold text-primary"
              >
                <Waypoints className="h-4 w-4" />
                Simple Mode
              </Link>
              <button
                onClick={() => navigate({ to: "/dashboard" })}
                className="mt-3 flex w-full items-center gap-2.5 rounded-md border border-border px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <ArrowLeftRight className="h-4 w-4" />
                Switch to Version 1
              </button>
            </>
          ) : (
            <>
              {NAV_DESTINATIONS.slice(0, 4).map((item) => {
                const active = pathname === item.to || pathname.startsWith(item.to + "/");
                return (
                  <Link
                    key={item.label}
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

              {NAV_DESTINATIONS.slice(4).map((item) => {
                const active = pathname === item.to || pathname.startsWith(item.to + "/");
                return (
                  <Link
                    key={item.label}
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

              <Link
                to="/guided"
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-semibold transition-colors",
                  pathname === "/guided"
                    ? "bg-primary/10 text-primary"
                    : "text-primary hover:bg-primary/10",
                )}
              >
                <Waypoints className="h-4 w-4" />
                Simple Mode
              </Link>
              <p className="px-2.5 pt-0.5 text-[11px] leading-snug text-muted-foreground">
                Everything above, as a guided icon flow.
              </p>
            </>
          )}
        </nav>

        <div className="flex items-center gap-2.5 border-t border-border px-4 py-3">
          <ProfileAvatarMenu />
          <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{profile?.email}</p>
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

function LayoutSwitch() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-1 rounded-full border border-border px-2 py-1 text-[10px] font-medium text-muted-foreground outline-none hover:text-foreground">
        Layout <ChevronDown className="h-3 w-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setLayoutPreference("sidebar")}>
          Sidebar (this one)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setLayoutPreference("classic")}>
          Classic top header
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
