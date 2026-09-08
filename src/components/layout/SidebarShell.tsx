import { type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronDown, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { setLayoutPreference } from "@/lib/layoutPreference";
import { useSidebarCollapsed } from "@/lib/sidebarCollapse";
import { NAV_DESTINATIONS } from "@/lib/navDestinations";
import { WorkspaceSwitcher } from "@/components/layout/WorkspaceSwitcher";
import { ViewSwitcher } from "@/components/layout/ViewSwitcher";
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
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isFocusedView = pathname.startsWith("/guided") || pathname.startsWith("/workflow");
  const [collapsed, toggleCollapsed] = useSidebarCollapsed();

  return (
    <div className="flex min-h-screen bg-background">
      <aside
        className={cn(
          "sticky top-0 flex h-screen shrink-0 flex-col border-r border-border bg-sidebar transition-[width] duration-200",
          collapsed ? "w-16" : "w-60",
        )}
      >
        <div className={cn("flex items-center border-b border-border py-4", collapsed ? "justify-center px-2" : "justify-between px-4")}>
          {!collapsed && <Logo className="h-6" />}
          {collapsed ? (
            <button
              onClick={toggleCollapsed}
              title="Expand navigation"
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <ChevronsRight className="h-4 w-4" />
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <button
                onClick={toggleCollapsed}
                title="Minimize navigation"
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <ChevronsLeft className="h-4 w-4" />
              </button>
              <LayoutSwitch />
            </div>
          )}
        </div>

        {!collapsed && (
          <div className="border-b border-border p-2">
            <WorkspaceSwitcher current={org?.name ?? "Trade Desk"} />
          </div>
        )}

        <nav className={cn("flex-1 space-y-0.5 overflow-y-auto py-3", collapsed ? "px-2" : "px-2")}>
          {isFocusedView ? (
            !collapsed && <ViewSwitcher variant="block" />
          ) : (
            <>
              {NAV_DESTINATIONS.slice(0, 4).map((item) => {
                const active = pathname === item.to || pathname.startsWith(item.to + "/");
                return (
                  <Link
                    key={item.label}
                    to={item.to}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                      collapsed && "justify-center px-0",
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {!collapsed && item.label}
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
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                      collapsed && "justify-center px-0",
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {!collapsed && item.label}
                  </Link>
                );
              })}

              <div className="my-3 border-t border-border" />

              {!collapsed && (
                <>
                  <ViewSwitcher variant="block" />
                  <p className="px-2.5 pt-1.5 text-[11px] leading-snug text-muted-foreground">
                    Simple Mode and Workflow View walk the same gates as a guided flow or a live
                    flowchart.
                  </p>
                </>
              )}
            </>
          )}
        </nav>

        <div className={cn("flex items-center gap-2.5 border-t border-border py-3", collapsed ? "justify-center px-2" : "px-4")}>
          <ProfileAvatarMenu />
          {!collapsed && <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{profile?.email}</p>}
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
