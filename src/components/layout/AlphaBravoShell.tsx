import { useEffect, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
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
  { to: "/alpha-bravo/about", label: "About" },
] as const;

/** Alpha-Bravo's own header/nav/footer — a demo re-skin of the Izenzo marketing site,
 * mirroring incisive.vc's page structure with content reframed to Izenzo's real Bidder/
 * Responder matching business. Same auth, same Supabase data, same business rules as the
 * Izenzo marketing site — this only changes what the pages look like and say. */
export function AlphaBravoShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  useEffect(() => {
    applyCurrentStylePreset();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <div className="relative mx-auto flex h-16 max-w-6xl items-center px-5">
          <Link to="/alpha-bravo" className="flex shrink-0 items-center gap-1.5">
            <Logo />
          </Link>

          <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-5 whitespace-nowrap text-sm text-muted-foreground lg:flex">
            {NAV.map((item) => (
              <Link key={item.to} to={item.to} className="hover:text-foreground">
                {item.label}
              </Link>
            ))}

            <Link to="/alpha-bravo/trades" className="hover:text-foreground">
              Trades
            </Link>
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-3">
            <ThemeToggle />
            {user ? (
              <>
                <Link to="/live-deal-engine">
                  <Button size="sm" className="rounded-full">
                    Live workspace
                  </Button>
                </Link>
                <ProfileAvatarMenu />
              </>
            ) : (
              <SignInModal>
                <Button size="sm" variant="outline" className="rounded-full">
                  Sign in
                </Button>
              </SignInModal>
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
