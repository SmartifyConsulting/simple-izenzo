import { useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Building2,
  Coins,
  Inbox,
  ShieldCheck,
  Menu,
  LogOut,
  BookText,
  Plus,
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

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/organisation", label: "Organisation", icon: Building2 },
  { to: "/inbox", label: "Counterparty inbox", icon: Inbox },
  { to: "/credits", label: "Tokens", icon: Coins },
  { to: "/glossary", label: "Glossary", icon: BookText },
  { to: "/admin", label: "Administration", icon: ShieldCheck, seats: ["admin"] },
];

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const { profile, org, roles, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = NAV.filter((n) => !n.seats || n.seats.some((r) => roles.includes(r)));

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
        <span className="flex h-6 w-6 items-center justify-center rounded bg-sidebar-primary text-[11px] font-bold text-sidebar-primary-foreground">
          IZ
        </span>
        <span className="text-sm font-semibold text-sidebar-primary">Izenzo</span>
      </div>

      <div className="px-4 py-4">
        <p className="label-caps text-sidebar-foreground/50">Organisation</p>
        <p className="mt-1 truncate text-sm font-medium text-sidebar-primary">
          {org?.name ?? "Not set up yet"}
        </p>
        <p className="mt-0.5 text-xs text-sidebar-foreground/60">
          {org ? `${org.credits} token${org.credits === 1 ? "" : "s"}` : "Add your details"}
        </p>
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
        <div className="px-1 pt-3">
          <Link to="/transactions/new" onClick={onNavigate}>
            <Button size="sm" variant="secondary" className="w-full gap-2">
              <Plus className="h-3.5 w-3.5" /> New transaction
            </Button>
          </Link>
        </div>
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-2.5 rounded px-2 py-2 text-left hover:bg-sidebar-accent/60">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sidebar-accent text-[11px] font-semibold text-sidebar-accent-foreground">
                {(profile?.full_name ?? profile?.email ?? "?").slice(0, 2).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium text-sidebar-primary">
                  {profile?.full_name ?? profile?.email}
                </span>
                <span className="block truncate text-[11px] text-sidebar-foreground/60">
                  {roles.join(" · ") || "party"} seat
                </span>
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              {profile?.email}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate({ to: "/organisation" })}>
              Organisation details
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={async () => {
                await signOut();
                navigate({ to: "/auth" });
              }}
            >
              <LogOut className="mr-2 h-3.5 w-3.5" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
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

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-60 shrink-0 border-r border-sidebar-border lg:block">
        <div className="sticky top-0 h-screen">
          <SidebarBody />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur sm:px-6">
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
            <h1 className="truncate text-sm font-semibold tracking-tight">{title}</h1>
            {description && (
              <p className="truncate text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          {actions}
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
