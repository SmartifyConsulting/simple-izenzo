import { Link } from "@tanstack/react-router";

/** The marketing-site header, shared by the home page and every content page (Glossary, Contact Us…).
 * Sign in only ever happens on the home page — this header never links to /auth. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center px-5">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded bg-foreground text-[11px] font-bold text-background">
            IZ
          </span>
          <span className="text-sm font-semibold tracking-tight">Izenzo</span>
        </Link>
      </div>
    </header>
  );
}
