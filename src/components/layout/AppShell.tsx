import { useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Coins,
  Inbox,
  ShieldCheck,
  Menu,
  LogOut,
  Settings,
  Receipt,
  LayoutDashboard,
  ChevronRight,
  Building2,
  Search,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SPINE, type StageKey } from "@/lib/spine";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/Logo";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function NavLink({
  to,
  icon: Icon,
  label,
  active,
  onClick,
}: {
  to: "/dashboard" | "/inbox" | "/credits" | "/registry" | "/facilitation";
  icon: typeof LayoutDashboard;
  label: string;
  active: boolean;
  onClick?: (() => void) | undefined;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={cn(
        "flex items-center gap-2.5 rounded px-2.5 py-2 text-sm transition-colors",
        active
          ? "bg-sidebar-accent text-white"
          : "text-white/90 hover:bg-sidebar-accent/60 hover:text-white",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </Link>
  );
}

function SidebarBody({ onNavigate }: { onNavigate?: (() => void) | undefined }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const search = useRouterState({ select: (s) => s.location.search as { stage?: string } });
  const [gatewayOpen, setGatewayOpen] = useState(true);

  const onGateway = pathname === "/dashboard" && Boolean(search.stage);

  const { data: gateCounts = {} } = useQuery({
    queryKey: ["sidebar-gate-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("transactions").select("stage");
      if (error) throw error;
      const counts: Partial<Record<StageKey, number>> = {};
      for (const row of data ?? []) {
        const stage = row.stage as StageKey;
        counts[stage] = (counts[stage] ?? 0) + 1;
      }
      return counts;
    },
  });

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <Link to="/dashboard" className="flex h-42 items-center px-3">
        <Logo onDark className="h-[1.96875rem] w-auto" />
      </Link>

      <nav className="flex-1 space-y-0.5 px-2 py-3">
        <NavLink
          to="/dashboard"
          icon={LayoutDashboard}
          label="Trades"
          active={pathname === "/dashboard" && !search.stage}
          onClick={onNavigate}
        />

        <button
          type="button"
          onClick={() => setGatewayOpen((v) => !v)}
          className={cn(
            "flex w-full items-center gap-2.5 rounded px-2.5 py-2 text-sm transition-colors",
            onGateway ? "text-white" : "text-white/90 hover:text-white",
          )}
        >
          <ChevronRight className={cn("h-4 w-4 shrink-0 transition-transform", gatewayOpen && "rotate-90")} />
          Gateway
        </button>
        {gatewayOpen && (
          <div className="ml-3 space-y-0.5 border-l border-sidebar-border pl-3">
            {SPINE.map((s) => (
              <Link
                key={s.key}
                to="/dashboard"
                search={{ stage: s.key }}
                onClick={onNavigate}
                className={cn(
                  "flex items-center justify-between gap-2 truncate rounded px-2.5 py-1.5 text-sm transition-colors",
                  search.stage === s.key
                    ? "bg-sidebar-accent text-white"
                    : "text-white/80 hover:bg-sidebar-accent/60 hover:text-white",
                )}
              >
                <span className="truncate">{s.label}</span>
                {Boolean(gateCounts[s.key]) && (
                  <span className="shrink-0 rounded-full bg-white px-1.5 py-0.5 text-[11px] font-semibold leading-none text-info">
                    {gateCounts[s.key]}
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}

        <NavLink
          to="/inbox"
          icon={Inbox}
          label="Inbox"
          active={pathname.startsWith("/inbox")}
          onClick={onNavigate}
        />
        <NavLink
          to="/credits"
          icon={Coins}
          label="Token Management"
          active={pathname.startsWith("/credits")}
          onClick={onNavigate}
        />
        <NavLink
          to="/registry"
          icon={Building2}
          label="Business Registry"
          active={pathname.startsWith("/registry")}
          onClick={onNavigate}
        />
        <NavLink
          to="/facilitation"
          icon={Search}
          label="Unknown Counterparty"
          active={pathname.startsWith("/facilitation")}
          onClick={onNavigate}
        />
      </nav>
    </div>
  );
}

function AvatarMenu() {
  const { profile, roles, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex shrink-0 items-center gap-2 rounded-full hover:opacity-80">
          <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-sidebar text-[11px] font-semibold text-sidebar-foreground">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              (profile?.full_name ?? profile?.email ?? "?").slice(0, 2).toUpperCase()
            )}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          {profile?.email}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
          Account
        </DropdownMenuLabel>
        <DropdownMenuItem onClick={() => navigate({ to: "/account/settings" })}>
          <Settings className="mr-2 h-3.5 w-3.5" /> Settings
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate({ to: "/account/billing" })}>
          <Receipt className="mr-2 h-3.5 w-3.5" /> Billing History
        </DropdownMenuItem>
        {roles.includes("admin") && (
          <DropdownMenuItem onClick={() => navigate({ to: "/admin" })}>
            <ShieldCheck className="mr-2 h-3.5 w-3.5" /> Administration
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={async () => {
            await signOut();
            navigate({ to: "/" });
          }}
        >
          <LogOut className="mr-2 h-3.5 w-3.5" /> Sign out
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <p className="px-2 py-1.5 text-[11px] text-muted-foreground">{roles.join(" · ") || "party"} seat</p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell({
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
  const [open, setOpen] = useState(false);
  const { profile, org } = useAuth();
  const firstName = (profile?.full_name ?? profile?.email ?? "").split(/[\s@]/)[0];

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-72 shrink-0 border-r border-sidebar-border lg:block">
        <div className="sticky top-0 h-screen">
          <SidebarBody />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 h-42 bg-background/95 backdrop-blur">
          <div className="flex h-full items-center gap-3 px-4 sm:px-6">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                <SheetTitle className="sr-only">Menu</SheetTitle>
                <SidebarBody onNavigate={() => setOpen(false)} />
              </SheetContent>
            </Sheet>
            <div className="grid h-full w-full grid-cols-1 lg:grid-cols-[1fr_5fr_5fr_1fr]">
              <div className="flex min-w-0 items-start gap-3 pt-7 lg:col-start-2 lg:col-span-2">
                <div className="min-w-0 flex-1">
                  {firstName && (
                    <p
                      className="truncate text-[2.025rem] leading-none tracking-tight sm:text-[2.25rem]"
                      style={{ fontFamily: "var(--font-greeting)", fontWeight: 700 }}
                    >
                      {greeting()}, {firstName}
                    </p>
                  )}
                  {title && (
                    <h1 className="mt-2 truncate text-sm font-semibold tracking-tight text-muted-foreground">
                      {title}
                    </h1>
                  )}
                  {description && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{description}</p>
                  )}
                </div>
                {actions && <div className="self-center">{actions}</div>}
                {org && (
                  <Link
                    to="/credits"
                    className="flex shrink-0 items-center gap-1.5 self-center rounded-full bg-success px-2.5 py-1 text-xs font-medium text-white transition-opacity hover:opacity-90"
                  >
                    <Coins className="h-3.5 w-3.5" />
                    {org.credits} token{org.credits === 1 ? "" : "s"}
                  </Link>
                )}
                <div className="self-center">
                  <AvatarMenu />
                </div>
              </div>
            </div>
          </div>
        </header>
        <main className="flex-1 px-4 pb-6 pt-2 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_5fr_5fr_1fr]">
            <div className="lg:col-start-2 lg:col-span-2">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
