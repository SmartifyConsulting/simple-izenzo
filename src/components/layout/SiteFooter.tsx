import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

const linkClass =
  "text-[11px] tracking-wide text-muted-foreground transition-colors hover:text-foreground sm:text-xs";

/** The shared footer, used by the marketing site and every signed-in page — pinned to the bottom
 * of the viewport (not just the end of the page content) so it's always visible rather than
 * trailing off after a long scroll. Callers that pin this add matching bottom padding to their
 * scrollable content so nothing renders underneath it. */
export function SiteFooter({ compact }: { compact?: boolean | undefined }) {
  return (
    <footer
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background",
        // 30% shorter than the standard h-16 ribbon — used on the Live Workspace, where vertical
        // space is at a premium.
        compact ? "h-11" : "h-16",
      )}
    >
      <div className="mx-auto flex h-full w-full items-center justify-between gap-4 px-5">
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
