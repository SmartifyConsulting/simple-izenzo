import { useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Coins,
  Inbox,
  ShieldCheck,
  Menu,
  LogOut,
  Settings,
  Receipt,
} from "lucide-react";
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
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; seats?: string[] };

const NAV: NavItem[] = [{ to: "/inbox", label: "Inbox", icon: Inbox }];

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const { org, roles } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = NAV.filter((n) => !n.seats || n.seats.some((r) => roles.includes(r)));

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <Link to="/dashboard" className="flex h-42 items-center gap-2 border-b border-sidebar-border px-4">
        <span className="flex h-36 w-36 shrink-0 items-center justify-center rounded-xl bg-sidebar-primary text-[66px] font-bold text-sidebar-primary-foreground">
          IZ
        </span>
        <span className="text-sm font-semibold text-sidebar-primary">Izenzo</span>
      </Link>

      <div className="flex items-center gap-2.5 px-4 py-4">
        {org?.avatar_url && (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-sidebar-accent">
            <img src={org.avatar_url} alt="" className="h-full w-full object-cover" />
          </span>
        )}
        <div className="min-w-0">
          <p className="label-caps text-sidebar-foreground/50">Organisation</p>
          <p className="truncate text-sm font-medium text-sidebar-primary">
            {org?.name ?? "Not set up yet"}
          </p>
          <p className="mt-0.5 text-xs text-sidebar-foreground/60">
            {org ? `${org.credits} token${org.credits === 1 ? "" : "s"}` : "Add your details"}
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 px-2">
        {items.map((item) => {
          const active = pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2.5 rounded px-2.5 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
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
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { profile, org } = useAuth();
  const firstName = (profile?.full_name ?? profile?.email ?? "").split(/[\s@]/)[0];

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-60 shrink-0 border-r border-sidebar-border lg:block">
        <div className="sticky top-0 h-screen">
          <SidebarBody />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-42 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur sm:px-6">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden">
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <SidebarBody onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <div className="min-w-0 flex-1">
            {firstName && (
              <p className="truncate text-[2.025rem] font-semibold tracking-tight sm:text-[2.25rem]">
                {greeting()}, {firstName}
              </p>
            )}
            <h1 className="truncate text-sm font-semibold tracking-tight text-muted-foreground">
              {title}
            </h1>
            {description && (
              <p className="truncate text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          {actions}
          {org && (
            <Link
              to="/credits"
              className="flex shrink-0 items-center gap-1.5 rounded-full bg-success px-2.5 py-1 text-xs font-medium text-white transition-opacity hover:opacity-90"
            >
              <Coins className="h-3.5 w-3.5" />
              {org.credits} token{org.credits === 1 ? "" : "s"}
            </Link>
          )}
          <AvatarMenu />
        </header>
        <main className="flex-1 px-4 pb-6 pt-[2cm] sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_5fr_5fr_1fr]">
            <div className="lg:col-start-2 lg:col-span-2">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
