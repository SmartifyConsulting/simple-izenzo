import { useEffect, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Coins, LayoutGrid, Moon, Sun, TerminalSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { useModules } from "@/lib/useModules";
import { ProfileAvatarMenu } from "@/components/guided/ProfileAvatarMenu";
import { initTheme, useTheme } from "@/lib/theme";

function ThemeToggle() {
  const [theme, toggle] = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground"
    >
      {theme === "dark" ? <Sun className="h-4 w-4 text-white" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
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
        <span className="hidden sm:inline">Quick Access</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass w-[min(760px,94vw)] p-6 sm:max-w-[min(760px,94vw)]">
          <DialogTitle className="text-base tracking-tight">Quick Access</DialogTitle>
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
          <ModuleLauncher />
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
              className="hidden shrink-0 items-center gap-1.5 rounded-full border border-primary/40 bg-primary/12 px-2.5 py-1 text-xs font-medium text-primary transition-opacity hover:opacity-90 sm:flex"
            >
              <Coins className="h-3.5 w-3.5" />
              {org.credits} token{org.credits === 1 ? "" : "s"}
            </Link>
          )}
          <ThemeToggle />
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
