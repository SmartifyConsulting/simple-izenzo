import { Link } from "@tanstack/react-router";

const linkClass =
  "text-[11px] tracking-wide text-muted-foreground transition-colors hover:text-foreground sm:text-xs";

/** The shared footer, used by the marketing site and every signed-in page. */
export function SiteFooter() {
  return (
    <footer className="border-t border-border/60">
      <div className="flex w-full items-center justify-between gap-4 px-5 py-6">
        <p className="whitespace-nowrap text-[11px] tracking-wide text-muted-foreground sm:text-xs">
          Izenzo is the trading name of Starfair162 (Pty) Ltd Reg: 2018 / 331720 / 07.
        </p>
        <nav aria-label="Footer" className="flex items-center gap-6">
          <Link to="/glossary" className={linkClass}>
            Glossary
          </Link>
          <a href="/privacy" className={linkClass}>
            Privacy
          </a>
          <a href="/terms" className={linkClass}>
            Terms &amp; Conditions
          </a>
          <a href="mailto:support@izenzo.co.za" className={linkClass}>
            Support
          </a>
        </nav>
      </div>
    </footer>
  );
}
