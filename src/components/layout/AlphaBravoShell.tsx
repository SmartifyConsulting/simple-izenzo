import { useEffect, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeftRight, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth";
import { applyAppSkin } from "@/lib/appSkin";

const NAV = [
  { to: "/alpha-bravo/how-it-works", label: "How It Works" },
  { to: "/alpha-bravo/pricing", label: "Pricing" },
] as const;

const COMPANY_MENU = [
  { to: "/alpha-bravo/about", label: "About" },
  { to: "/alpha-bravo/insights", label: "Insights" },
] as const;

const GET_STARTED_MENU = [
  { to: "/alpha-bravo/bidders", label: "Bidders" },
  { to: "/alpha-bravo/responders", label: "Responders" },
] as const;

/** Alpha-Bravo's own header/nav/footer — a demo re-skin of the Izenzo marketing site,
 * mirroring incisive.vc's page structure with content reframed to Izenzo's real Bidder/
 * Responder matching business. Same auth, same Supabase data, same business rules as the
 * Izenzo marketing site — this only changes what the pages look like and say. */
export function AlphaBravoShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  useEffect(() => {
    applyAppSkin("alpha-bravo");
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-5">
          <Link to="/alpha-bravo" className="shrink-0">
            <span className="inline-flex items-center gap-1.5 text-base font-medium tracking-tight text-foreground">
              <span className="text-muted-foreground">/</span> Izenzo{" "}
              <span className="text-primary">Alpha-Bravo</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-6 text-sm text-muted-foreground sm:flex">
            {NAV.map((item) => (
              <Link key={item.to} to={item.to} className="hover:text-foreground">
                {item.label}
              </Link>
            ))}

            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1 outline-none hover:text-foreground">
                Company <ChevronDown className="h-3.5 w-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {COMPANY_MENU.map((item) => (
                  <DropdownMenuItem key={item.to} asChild>
                    <Link to={item.to}>{item.label}</Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1 outline-none hover:text-foreground">
                Get Started <ChevronDown className="h-3.5 w-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {GET_STARTED_MENU.map((item) => (
                  <DropdownMenuItem key={item.to} asChild>
                    <Link to={item.to}>{item.label}</Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Link to="/alpha-bravo/trades" className="hover:text-foreground">
              Trades
            </Link>
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-3">
            <Link
              to="/"
              className="flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              title="Switch back to Izenzo"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
              Izenzo
            </Link>
            {user ? (
              <Link to="/live-deal-engine">
                <Button size="sm" className="rounded-full">
                  Go to app
                </Button>
              </Link>
            ) : (
              <>
                <Link
                  to="/auth"
                  search={{ mode: "signin", next: undefined }}
                  className="hidden text-sm font-medium text-muted-foreground hover:text-foreground sm:inline"
                >
                  Sign In
                </Link>
                <Link to="/auth" search={{ mode: "signup", next: undefined }}>
                  <Button size="sm" className="rounded-full">
                    Post an Opportunity
                  </Button>
                </Link>
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

/** Small square-bracket step label used on the Trades/Insights list pages, matching the
 * reference site's "01 / 02 / 03" numbered-list styling. */
export function AlphaBravoEyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
      {children}
    </p>
  );
}
