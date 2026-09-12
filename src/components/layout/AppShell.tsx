import { useEffect, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BarChart3, ChevronDown, Coins, DollarSign, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

import { Logo } from "@/components/Logo";
import { SearchButton } from "@/components/layout/SearchButton";
import { ProfileAvatarMenu } from "@/components/guided/ProfileAvatarMenu";
import { ThemeToggle } from "@/components/guided/ThemeToggle";
import { SiteFooter } from "@/components/layout/SiteFooter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { applyCurrentStylePreset } from "@/lib/stylePreset";

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
  pureBlack,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  wide?: boolean;
  /** Forces the page background to literal black instead of the theme's near-black
   * `--background`, for screens meant to sit flush with the header/nav's own black chrome. */
  pureBlack?: boolean;
}) {
  const { profile, org } = useAuth();
  const firstName = (profile?.full_name ?? profile?.email ?? "").split(/[\s@]/)[0];

  // Keeps `profiles.last_accessed_at` fresh while this person actually has the app open, so the
  // green/amber/red presence dot elsewhere in the app reflects real activity rather than just the
  // moment they last signed in.
  useEffect(() => {
    if (!profile?.id) return;
    const beat = () => {
      if (document.visibilityState !== "visible") return;
      void supabase.from("profiles").update({ last_accessed_at: new Date().toISOString() }).eq("id", profile.id);
    };
    beat();
    const interval = setInterval(beat, 60_000);
    document.addEventListener("visibilitychange", beat);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", beat);
    };
  }, [profile?.id]);
  const width = wide ? "max-w-[1680px]" : "max-w-7xl";
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const onEngine = pathname === "/live-deal-engine";

  // Unread Inbox notifications — e.g. "this counterparty matched on all checks".
  const { data: unread = 0 } = useQuery({
    queryKey: ["notifications-unread", org?.id],
    enabled: Boolean(org?.id),
    refetchInterval: 60_000,
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("read", false);
      return count ?? 0;
    },
  });

  // Document-style screens (settings, admin, reporting, API docs) drop the canvas grid and give
  // every frame the same green edge — the grid belongs to the deal canvas, not to tables and forms.
  const flat = ["/account", "/admin", "/credits", "/trades", "/activity", "/developer", "/docs"].some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  useEffect(() => {
    applyCurrentStylePreset();
  }, []);

  return (
    <div
      className={cn(
        "flex min-h-screen flex-col overflow-x-hidden",
        flat ? "flat-frames" : "ink-grid",
        pureBlack ? "" : "bg-background",
      )}
      style={pureBlack ? { backgroundColor: "#000" } : undefined}
    >
      <header className="sticky top-0 z-30 border-b border-border bg-background/70 backdrop-blur-xl">
        <div className={cn("mx-auto flex h-16 items-center gap-3 px-4 sm:px-6", width)}>
          <Link to="/live-deal-engine" className="shrink-0" aria-label="Izenzo — workflow">
            <Logo onDark className="h-7 w-auto" />
          </Link>
          <a
            href="/alpha-bravo"
            className="label-caps flex shrink-0 items-center gap-1.5 transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Home
          </a>

          <div className="min-w-0 flex-1" />
          {org && (
            <Link
              to="/credits"
              search={{ returnTo: undefined }}

              aria-label={`${org.credits} token${org.credits === 1 ? "" : "s"} — Token Management`}
              className="flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-primary/40 bg-primary/12 px-2.5 text-xs font-semibold text-foreground"
            >
              <Coins className="h-4 w-4 text-primary" strokeWidth={2.25} />
              {org.credits}
            </Link>
          )}
          <nav className="flex shrink-0 items-center gap-3 text-sm font-medium text-foreground/80 sm:gap-5">
            <SearchButton />
            <a
              href="/pricing"
              className="flex items-center transition-colors hover:text-primary"
              title="Pricing"
              aria-label="Pricing"
            >
              <DollarSign className="h-5 w-5" strokeWidth={2.25} />
            </a>
            {/* Developer/API surfaces are hidden from the interface for now — the pages live in
             * .hidden-surfaces/developer and can be restored later. */}
            <DropdownMenu>
              <DropdownMenuTrigger
                className="flex items-center gap-1 outline-none transition-colors hover:text-primary"
                title="Report"
                aria-label="Report"
              >
                <BarChart3 className="h-5 w-5" strokeWidth={2.25} />
                <ChevronDown className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem asChild>
                  <Link to="/trades">All Trades</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/credits" search={{ returnTo: undefined }}>
                    Token Management
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>
          <Link
            to="/inbox"
            title="Inbox"
            className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-foreground/80 transition-colors hover:text-primary"
          >
            <Mail className="h-5 w-5" strokeWidth={2.25} />
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                {unread}
              </span>
            )}
          </Link>

          <ThemeToggle />

          <ProfileAvatarMenu />
        </div>
      </header>

      <main className={cn("mx-auto w-full flex-1 px-4 pb-8 sm:px-6", width, wide ? "pt-3" : "pt-5")}>
        <div
          className={cn(
            "grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4",
            wide ? "mb-2" : "mb-4",
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
            {!onEngine && (
              <Link
                to="/live-deal-engine"
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Return to Engine
              </Link>
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

      <SiteFooter />
    </div>
  );

}
