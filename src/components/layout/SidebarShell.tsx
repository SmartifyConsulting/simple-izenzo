import type { ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Search,
  Building2,
  ArrowLeftRight,
  ShieldCheck,
  CreditCard,
  Settings,
  Bell,
  LogOut,
  ChevronDown,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { setLayoutPreference } from "@/lib/layoutPreference";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const NAV = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/discover", label: "Counterparties", icon: Search },
  { to: "/registry", label: "Company Register", icon: Building2 },
  { to: "/dashboard", label: "My Trades", icon: ArrowLeftRight },
  { to: "/account/settings", label: "Compliance", icon: ShieldCheck },
  { to: "/credits", label: "Billing", icon: CreditCard },
  { to: "/account/settings", label: "Settings", icon: Settings },
  { to: "/inbox", label: "Notifications", icon: Bell },
] as const;

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
          {NAV.map((item) => {
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
