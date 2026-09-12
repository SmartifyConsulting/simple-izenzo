import { useEffect, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Coins, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { applyCurrentStylePreset } from "@/lib/stylePreset";
import { ProfileAvatarMenu } from "@/components/guided/ProfileAvatarMenu";
import { ThemeToggle } from "@/components/guided/ThemeToggle";
import { SignInModal } from "@/components/auth/SignInModal";
import { Logo } from "@/components/Logo";
import { HeroSearchProvider, seedNext, useHeroSearch } from "@/lib/heroSearchContext";

const NAV = [
  { to: "/alpha-bravo/about", label: "About Izenzo" },
  { to: "/alpha-bravo/how-it-works", label: "How It Works" },
  { to: "/alpha-bravo/intelligence-fabric", label: "The Intelligence Fabric" },
  { to: "/alpha-bravo/pricing", label: "Pricing" },
] as const;

/** Alpha-Bravo's own header/nav/footer — a demo re-skin of the Izenzo marketing site,
 * mirroring incisive.vc's page structure with content reframed to Izenzo's real Bidder/
 * Responder matching business. Same auth, same Supabase data, same business rules as the
 * Izenzo marketing site — this only changes what the pages look like and say. */
export function AlphaBravoShell({ children }: { children: ReactNode }) {
  useEffect(() => {
    applyCurrentStylePreset();
  }, []);

  return (
    <HeroSearchProvider>
      <AlphaBravoShellInner>{children}</AlphaBravoShellInner>
    </HeroSearchProvider>
  );
}

function AlphaBravoShellInner({ children }: { children: ReactNode }) {
  const { user, org } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // The home page shows a Sign In/Sign Up toggle instead of the plain "Sign in" button used
  // everywhere else, so a visitor sees both options are open to them right away.
  const isHome = pathname === "/alpha-bravo" || pathname === "/alpha-bravo/";
  // Whatever the visitor already typed into the homepage's search bar — carried into the sign
  // in/up destination so it isn't lost the moment they authenticate.
  const { prompt } = useHeroSearch();
  const next = isHome ? seedNext(prompt) : undefined;

  // Same unread Inbox count the Trade Desk header shows.
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

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-5">
          <Link to="/alpha-bravo" className="flex shrink-0 items-center gap-1.5">
            <Logo />
          </Link>

          <nav className="ml-auto hidden items-center gap-2 whitespace-nowrap text-sm text-muted-foreground lg:flex">
            {[...NAV, { to: "/alpha-bravo/trades", label: "Trades" } as const].map((item) => {
              const active = pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "rounded-full border border-transparent px-3 py-1.5 transition-colors",
                    active
                      ? "bg-foreground text-background"
                      : "hover:bg-foreground/10 hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-6 flex shrink-0 items-center gap-3 lg:ml-3">
            {user ? (
              <>
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

      <main>{children}</main>

      {/* Bottom banner — a full-width, contrasting band that holds the footer, so it reads as a
          deliberate close to the page rather than a thin line of fine print blending into it. */}
      <div className="bg-foreground text-background">
        <footer className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-5">
          <p className="whitespace-nowrap text-[11px] tracking-wide text-background/70 sm:text-xs">
            Izenzo is the trading name of Starfair162 (Pty) Ltd Reg: 2018 / 331720 / 07.
          </p>
          <nav aria-label="Footer" className="flex items-center gap-6">
            <Link
              to="/alpha-bravo/trust-center"
              className="text-[11px] tracking-wide text-background/70 transition-colors hover:text-background sm:text-xs"
            >
              Trust Center
            </Link>
            <a
              href="/privacy"
              className="text-[11px] tracking-wide text-background/70 transition-colors hover:text-background sm:text-xs"
            >
              Privacy
            </a>
            <a
              href="/terms"
              className="text-[11px] tracking-wide text-background/70 transition-colors hover:text-background sm:text-xs"
            >
              Terms &amp; Conditions
            </a>
            <a
              href="mailto:support@izenzo.co.za"
              className="text-[11px] tracking-wide text-background/70 transition-colors hover:text-background sm:text-xs"
            >
              Support
            </a>
          </nav>
        </footer>
      </div>
    </div>
  );
}

/** Small square-bracket step label used on the Trades/Blog list pages, matching the
 * reference site's "01 / 02 / 03" numbered-list styling. */
export function AlphaBravoEyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
      {children}
    </p>
  );
}
