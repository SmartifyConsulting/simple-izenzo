import { Link } from "@tanstack/react-router";

/** The marketing-site footer, shared by the home page and every content page. */
export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 sm:flex-row">
        <p className="text-center text-[11px] tracking-wide text-muted-foreground sm:text-left sm:text-xs">
          Izenzo is the trading name of Starfair162 (Pty) Ltd Reg: 2018 / 331720 / 07.
        </p>
        <nav aria-label="Footer" className="flex items-center gap-6">
          <Link
            to="/glossary"
            className="text-[11px] tracking-wide text-muted-foreground transition-colors hover:text-foreground sm:text-xs"
          >
            Terms &amp; Glossary
          </Link>
          <a
            href="/docs"
            className="text-[11px] tracking-wide text-muted-foreground transition-colors hover:text-foreground sm:text-xs"
          >
            Docs
          </a>
          <a
            href="/status"
            className="text-[11px] tracking-wide text-muted-foreground transition-colors hover:text-foreground sm:text-xs"
          >
            Status
          </a>
          <a
            href="/pricing"
            className="text-[11px] tracking-wide text-muted-foreground transition-colors hover:text-foreground sm:text-xs"
          >
            Pricing
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
  );
}
