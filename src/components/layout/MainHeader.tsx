import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Coins, Mail, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Logo } from "@/components/Logo";
import { BugReportMenu } from "@/components/BugReportMenu";

import { ProfileAvatarMenu } from "@/components/guided/ProfileAvatarMenu";
import { ThemeToggle } from "@/components/guided/ThemeToggle";
import { SignInModal } from "@/components/auth/SignInModal";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { seedNext, useHeroSearchOptional } from "@/lib/heroSearchContext";
import { cn } from "@/lib/utils";

/** The one menu the whole app uses — public pages and signed-in screens alike, so no screen has
 * a different set of items to any other. */
const NAV = [
  { to: "/alpha-bravo", label: "Home" },
  { to: "/alpha-bravo/about", label: "About Izenzo" },
  { to: "/alpha-bravo/how-it-works", label: "How It Works" },
  { to: "/alpha-bravo/intelligence-fabric", label: "The Intelligence Fabric" },
  { to: "/alpha-bravo/pricing", label: "Pricing" },
  // Signed out, this is the public showcase of illustrative matches; signed in, "Trades" should
  // mean the person's own trades (with the All/My Trades/stage filters) — not the marketing page
  // they've already moved past.
  { to: "/alpha-bravo/trades", signedInTo: "/trades", label: "Trades" },
] as const;

export function MainHeader() {
  const { user, org } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isHome = pathname === "/alpha-bravo" || pathname === "/alpha-bravo/";
  // Whatever was typed into the homepage search bar, so signing in carries it into the workspace.
  const { prompt } = useHeroSearchOptional();
  const next = isHome ? seedNext(prompt) : undefined;

  const { data: unread = 0 } = useQuery({
    queryKey: ["notifications-unread", org?.id],
    enabled: Boolean(org?.id) && Boolean(user),
    refetchInterval: 60_000,
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("read", false);
      return count ?? 0;
    },
  });

  const isActive = (to: string) =>
    to === "/alpha-bravo" ? isHome : pathname.startsWith(to);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="relative mx-auto flex h-16 w-full max-w-[1680px] items-center px-5">
        <Link to={user ? "/live-deal-engine" : "/alpha-bravo"} className="flex shrink-0 items-center gap-1.5">
          <Logo />
        </Link>

        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-2 whitespace-nowrap text-sm text-muted-foreground lg:flex">
          {NAV.map((item) => {
            const to = user && "signedInTo" in item ? item.signedInTo : item.to;
            return (
              <Link
                key={item.to}
                to={to}
                className={cn(
                  "rounded-full border border-transparent px-3 py-1.5 transition-colors",
                  isActive(to)
                    ? "bg-foreground text-background"
                    : "hover:bg-foreground/10 hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Narrow screens keep every destination behind one menu button. */}
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Menu"
            className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-foreground/80 outline-none transition-colors hover:text-primary lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {NAV.map((item) => {
              const to = user && "signedInTo" in item ? item.signedInTo : item.to;
              return (
                <DropdownMenuItem key={item.to} asChild>
                  <Link to={to}>{item.label}</Link>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="ml-auto flex shrink-0 items-center gap-3">
          {user ? (
            <>
              <BugReportMenu />
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
              <ThemeToggle />
              <ProfileAvatarMenu />
            </>
          ) : isHome ? (
            <>
              <div className="flex items-center gap-1 rounded-full border border-border p-1">
                <SignInModal defaultTab="signin" next={next}>
                  <button
                    type="button"
                    className="rounded-full bg-foreground px-3 py-1 text-xs font-medium text-background transition-colors"
                  >
                    Sign In
                  </button>
                </SignInModal>
                <SignInModal defaultTab="signup" next={next}>
                  <button
                    type="button"
                    className="rounded-full px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    Sign Up
                  </button>
                </SignInModal>
              </div>
              <ThemeToggle />
            </>
          ) : (
            <>
              <ThemeToggle />
              <SignInModal>
                <Button size="sm" variant="outline" className="rounded-full">
                  Sign in
                </Button>
              </SignInModal>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
