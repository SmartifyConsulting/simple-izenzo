import { useEffect, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { applyCurrentStylePreset } from "@/lib/stylePreset";
import { MainHeader } from "@/components/layout/MainHeader";
import { HeroSearchProvider } from "@/lib/heroSearchContext";

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

      {/* pb-16 clears the footer band below, now pinned to the viewport like the Live Workspace's
          own taskbar rather than trailing off at the end of a long page. */}
      <main className="pb-[3.2rem]">{children}</main>

      {/* Bottom banner — a full-width, contrasting band that holds the footer, so it reads as a
          deliberate close to the page rather than a thin line of fine print blending into it.
          h-[3.2rem] is h-16 (4rem) reduced 20%. */}
      <div className="fixed inset-x-0 bottom-0 z-30 bg-foreground text-background">
        <footer className="mx-auto flex h-[3.2rem] w-full max-w-6xl items-center justify-between gap-4 px-5">
          <p className="whitespace-nowrap text-[11px] tracking-wide text-background/70 sm:text-xs">
            Izenzo is the trading name of Starfair162 (Pty) Ltd Reg: 2018 / 331720 / 07
          </p>
          <nav aria-label="Footer" className="flex items-center gap-6">
            <Link
              to="/trust-center"
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
  return <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">{children}</p>;
}
