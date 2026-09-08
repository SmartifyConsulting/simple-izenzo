import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";

/** The marketing-site header, shared by the home page and every content page (Glossary, Contact Us…).
 * Sign in only ever happens on the home page — this header never links to /auth. */
export function SiteHeader({
  logoClassName,
  containerClassName,
  logoVariant,
  logoOnDark,
}: {
  logoClassName?: string | undefined;
  containerClassName?: string | undefined;
  logoVariant?: "white" | "blue" | undefined;
  logoOnDark?: boolean | undefined;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className={cn("mx-auto flex h-14 max-w-6xl items-center px-5", containerClassName)}>
        <Link to="/">
          <Logo className={logoClassName} variant={logoVariant} onDark={logoOnDark} />
        </Link>
      </div>
    </header>
  );
}
