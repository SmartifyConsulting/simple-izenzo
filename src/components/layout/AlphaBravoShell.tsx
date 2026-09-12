import { useEffect, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { applyCurrentStylePreset } from "@/lib/stylePreset";
import { ProfileAvatarMenu } from "@/components/guided/ProfileAvatarMenu";
import { ThemeToggle } from "@/components/guided/ThemeToggle";
import { SignInModal } from "@/components/auth/SignInModal";
import { Logo } from "@/components/Logo";

const NAV = [
  { to: "/live-deal-engine", label: "Live Workspace" },
  { to: "/alpha-bravo/how-it-works", label: "How It Works" },
  { to: "/alpha-bravo/intelligence-fabric", label: "The Intelligence Fabric" },
  { to: "/alpha-bravo/pricing", label: "Pricing" },
  { to: "/alpha-bravo/about", label: "About Izenzo" },
] as const;

/** Alpha-Bravo's own header/nav/footer — a demo re-skin of the Izenzo marketing site,
 * mirroring incisive.vc's page structure with content reframed to Izenzo's real Bidder/
 * Responder matching business. Same auth, same Supabase data, same business rules as the
 * Izenzo marketing site — this only changes what the pages look like and say. */
export function AlphaBravoShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // The home page shows a Sign In/Sign Up toggle instead of the plain "Sign in" button used
  // everywhere else, so a visitor sees both options are open to them right away.
  const isHome = pathname === "/alpha-bravo" || pathname === "/alpha-bravo/";

  useEffect(() => {
    applyCurrentStylePreset();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-5">
          <Link to="/alpha-bravo" className="flex shrink-0 items-center gap-1.5">
            <Logo />
          </Link>

          <nav className="ml-auto hidden items-center gap-2 whitespace-nowrap text-sm text-muted-foreground lg:flex">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="rounded-full border border-transparent px-3 py-1.5 transition-colors hover:border-border hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}

            <Link
              to="/alpha-bravo/trades"
              className="rounded-full border border-transparent px-3 py-1.5 transition-colors hover:border-border hover:text-foreground"
            >
              Trades
            </Link>
          </nav>

          <div className="ml-6 flex shrink-0 items-center gap-3 lg:ml-3">
            {user ? (
              <>
                <ThemeToggle />
                <Link to="/live-deal-engine">
                  <Button size="sm" className="rounded-full">
                    Live workspace
                  </Button>
                </Link>
                <ProfileAvatarMenu />
              </>
            ) : isHome ? (
              <>
                <div className="flex items-center gap-1 rounded-full border border-border p-1">
                  <SignInModal defaultTab="signin">
                    <button
                      type="button"
                      className="rounded-full bg-foreground px-3 py-1 text-xs font-medium text-background transition-colors"
                    >
                      Sign In
                    </button>
                  </SignInModal>
                  <SignInModal defaultTab="signup">
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

      <footer className="border-t border-border">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-5">
          <p className="whitespace-nowrap text-[11px] tracking-wide text-muted-foreground sm:text-xs">
            Izenzo is the trading name of Starfair162 (Pty) Ltd Reg: 2018 / 331720 / 07.
          </p>
          <nav aria-label="Footer" className="flex items-center gap-6">
            <Link
              to="/alpha-bravo/trust-center"
              className="text-[11px] tracking-wide text-muted-foreground transition-colors hover:text-foreground sm:text-xs"
            >
              Trust Center
            </Link>
            <a
              href="/privacy"
              className="text-[11px] tracking-wide text-muted-foreground transition-colors hover:text-foreground sm:text-xs"
            >
              Privacy
            </a>
            <a
              href="/terms"
              className="text-[11px] tracking-wide text-muted-foreground transition-colors hover:text-foreground sm:text-xs"
            >
              Terms &amp; Conditions
            </a>
            <a
              href="mailto:support@izenzo.co.za"
              className="text-[11px] tracking-wide text-muted-foreground transition-colors hover:text-foreground sm:text-xs"
            >
              Support
            </a>
          </nav>
        </div>
      </footer>
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
