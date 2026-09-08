import { useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Coins,
  Inbox,
  ShieldCheck,
  LogOut,
  Settings,
  LayoutDashboard,
  Building2,
  Search,
  LifeBuoy,
  ShieldAlert,
  Banknote,
  LayoutGrid,
} from "lucide-react";
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
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/Logo";

type NavTo =
  | "/dashboard"
  | "/inbox"
  | "/credits"
  | "/registry"
  | "/facilitation"
  | "/support"
  | "/auditor"
  | "/funder"
  | "/admin";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** Modules reachable from the command bar. The sidebar is gone: everything opens from here. */
function useModules() {
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const isAuditor = roles.includes("auditor") || isAdmin;
  const isFunder = roles.includes("funder") || isAdmin;

  const modules: { to: NavTo; label: string; icon: typeof Inbox; blurb: string }[] = [
    { to: "/dashboard", label: "Deals", icon: LayoutDashboard, blurb: "Every live deal canvas" },
    { to: "/inbox", label: "Inbox", icon: Inbox, blurb: "Requests waiting on you" },
    { to: "/credits", label: "Tokens", icon: Coins, blurb: "Balance and top-ups" },
    { to: "/registry", label: "Registry", icon: Building2, blurb: "Known businesses" },
    {
      to: "/facilitation",
      label: "Unknown counterparty",
      icon: Search,
      blurb: "Find and surface a party",
    },
    { to: "/support", label: "Support", icon: LifeBuoy, blurb: "Talk to us" },
  ];
  if (isFunder)
    modules.push({ to: "/funder", label: "Funder", icon: Banknote, blurb: "Funding positions" });
  if (isAuditor)
    modules.push({
      to: "/auditor",
      label: "Auditor",
      icon: ShieldAlert,
      blurb: "Read-only assurance",
    });
  if (isAdmin)
    modules.push({ to: "/admin", label: "Admin", icon: ShieldCheck, blurb: "People and platform" });
  return modules;
}

function ModuleLauncher() {
  const [open, setOpen] = useState(false);
  const modules = useModules();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-2 rounded-full border border-border bg-muted px-3"
      >
        <LayoutGrid className="h-4 w-4" />
        <span className="hidden sm:inline">Modules</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass w-[min(760px,94vw)] p-6 sm:max-w-[min(760px,94vw)]">
          <DialogTitle className="text-base tracking-tight">Open a module</DialogTitle>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {modules.map((m) => {
              const active = pathname.startsWith(m.to);
              return (
                <Link
                  key={m.to}
                  to={m.to}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "glass-node block px-4 py-3.5 transition-transform hover:-translate-y-0.5",
                    active && "node-active",
                  )}
                >
                  <span className="flex items-center gap-2 text-[13.5px] font-semibold tracking-tight">
                    <m.icon className="h-4 w-4 text-primary" />
                    {m.label}
                  </span>
                  <span className="mt-1 block text-[12px] text-muted-foreground">{m.blurb}</span>
                </Link>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AvatarMenu() {
  const { profile, roles, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex shrink-0 items-center gap-2 rounded-full hover:opacity-80">
          <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-[13px] font-semibold text-foreground">
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
        <DropdownMenuItem onClick={() => navigate({ to: "/account/settings" })}>
          <Settings className="mr-2 h-3.5 w-3.5" /> Settings
        </DropdownMenuItem>
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
        <p className="px-2 py-1.5 text-[11px] text-muted-foreground">
          {roles.join(" · ") || "party"} seat
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell({
  title,
  description,
  actions,
  children,
  wide,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  const { profile, org } = useAuth();
  const firstName = (profile?.full_name ?? profile?.email ?? "").split(/[\s@]/)[0];
  const width = wide ? "max-w-[1680px]" : "max-w-7xl";

  return (
    <div className="ink-grid min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/70 backdrop-blur-xl">
        <div className={cn("mx-auto flex h-16 items-center gap-3 px-4 sm:px-6", width)}>
          <Link to="/dashboard" className="shrink-0">
            <Logo onDark className="h-7 w-auto" />
          </Link>
          <ModuleLauncher />
          <div className="min-w-0 flex-1" />
          {org && (
            <Link
              to="/credits"
              className="hidden shrink-0 items-center gap-1.5 rounded-full border border-primary/40 bg-primary/12 px-2.5 py-1 text-xs font-medium text-primary transition-opacity hover:opacity-90 sm:flex"
            >
              <Coins className="h-3.5 w-3.5" />
              {org.credits} token{org.credits === 1 ? "" : "s"}
            </Link>
          )}
          <AvatarMenu />
        </div>
      </header>

      <main className={cn("mx-auto px-4 pb-14 sm:px-6", width, wide ? "pt-4" : "pt-6")}>
        <div
          className={cn(
            "grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4",
            wide ? "mb-3" : "mb-6",
          )}
        >
          <div className="min-w-0">
            {firstName && (
              <p
                className={cn(
                  "truncate leading-[1.15] tracking-tight",
                  wide
                    ? "text-[1.15rem] sm:text-[1.3rem]"
                    : "text-[1.75rem] sm:text-[2rem]",
                )}
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
              <p className="mt-1 truncate text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          {actions && <div>{actions}</div>}
        </div>
        {children}
      </main>
    </div>
  );
}
