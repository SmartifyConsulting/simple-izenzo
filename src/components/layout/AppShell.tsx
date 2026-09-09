import { useEffect, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Coins, LayoutDashboard, Mail, TerminalSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { SearchButton } from "@/components/layout/SearchButton";
import { ProfileAvatarMenu } from "@/components/guided/ProfileAvatarMenu";
import { initTheme } from "@/lib/theme";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** Classic is the app's one committed view — no layout or view selector, just this shell. */
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

  useEffect(() => {
    initTheme();
  }, []);

  return (
    <div className="ink-grid min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/70 backdrop-blur-xl">
        <div className={cn("mx-auto flex h-16 items-center gap-3 px-4 sm:px-6", width)}>
          <Link to="/dashboard" className="shrink-0">
            <Logo onDark className="h-7 w-auto" />
          </Link>
          <Link to="/dashboard">
            <Button variant="ghost" size="sm" className="gap-2 rounded-full border border-border bg-muted px-3">
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline">Deals</span>
            </Button>
          </Link>
          <SearchButton />
          <Link to="/developer/keys">
            <Button variant="ghost" size="sm" className="gap-2 rounded-full border border-border bg-muted px-3">
              <TerminalSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Developer Centre</span>
            </Button>
          </Link>
          <div className="min-w-0 flex-1" />
          {org && (
            <Link
              to="/credits"
              search={{ returnTo: undefined }}

              title={`${org.credits} token${org.credits === 1 ? "" : "s"} — open Token Management`}
              className="flex h-6 shrink-0 items-center gap-1 rounded-full border border-primary/40 bg-primary/12 px-2 text-[11px] font-semibold text-primary transition-opacity hover:opacity-90"
            >
              <Coins className="h-3 w-3" />
              {org.credits}
            </Link>
          )}
          <Link
            to="/inbox"
            title="Inbox"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground"
          >
            <Mail className="h-4 w-4" />
          </Link>
          <ProfileAvatarMenu />
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
