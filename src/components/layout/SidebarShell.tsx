import { useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LogOut, ChevronDown, ExternalLink, Waypoints, Keyboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { setLayoutPreference } from "@/lib/layoutPreference";
import { NAV_DESTINATIONS } from "@/lib/navDestinations";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const SHORTCUT_KEYS: Record<string, string> = {
  Overview: "o",
  Counterparties: "c",
  "Company Register": "r",
  "My Trades": "t",
  Compliance: "k",
  Billing: "b",
  Settings: "s",
};

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
  const { profile, org, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-sidebar">
        <div className="flex items-center justify-between border-b border-border px-4 py-4">
          <Logo className="h-6" />
          <LayoutSwitch />
        </div>

        <div className="border-b border-border px-4 py-3">
          <p className="truncate text-sm font-semibold">{org?.name ?? "Trade Desk"}</p>
          <p className="text-xs text-muted-foreground">Governance live desk</p>
        </div>

        <nav className="flex-1 space-y-0.5 px-2 py-3">
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
        </nav>

        <div className="border-t border-border px-4 py-3">
          <p className="truncate text-xs text-muted-foreground">{profile?.email}</p>
          <div className="mt-2 flex items-center gap-3">
            <Link to="/" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <ExternalLink className="h-3 w-3" /> View public site
            </Link>
            <button
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={async () => {
                await signOut();
                navigate({ to: "/" });
              }}
            >
              <LogOut className="h-3 w-3" /> Sign out
            </button>
          </div>
          <ShortcutsHelp />
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

function ShortcutsHelp() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        onClick={() => setOpen(true)}
      >
        <Keyboard className="h-3 w-3" /> Keyboard shortcuts
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[min(360px,92vw)]">
          <DialogTitle className="text-sm">Keyboard shortcuts</DialogTitle>
          <DialogDescription className="text-xs">
            Press "g" then a letter to jump anywhere, from any page.
          </DialogDescription>
          <div className="mt-2 space-y-1.5">
            {NAV_DESTINATIONS.filter((d) => SHORTCUT_KEYS[d.label]).map((d) => (
              <div key={d.label} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <d.icon className="h-3.5 w-3.5" /> {d.label}
                </span>
                <span className="flex items-center gap-1 font-mono text-xs">
                  <kbd className="rounded border border-border bg-muted px-1.5 py-0.5">g</kbd>
                  <span className="text-muted-foreground">then</span>
                  <kbd className="rounded border border-border bg-muted px-1.5 py-0.5">
                    {SHORTCUT_KEYS[d.label]}
                  </kbd>
                </span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
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
