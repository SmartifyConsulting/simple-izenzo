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
  { to: "/alpha-bravo", label: "Home" },
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
  return (
    <div className="min-h-screen bg-background">
      {/* One shared menu across every screen in the app. */}
      <MainHeader />

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
