import { Link } from "@tanstack/react-router";
import { Mail } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { ProfileAvatarMenu } from "@/components/guided/ProfileAvatarMenu";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

/** The site header, shared by the home page, every marketing/content page (Glossary, Contact
 * Us…) and, once signed in, the same nav carries Pricing/Inbox/Profile — same as the app shell.
 * Search lives only on the canvas (top-left of the main content), never in a header, so its
 * placement stays consistent across every screen. */
export function SiteHeader({
  logoClassName,
  containerClassName,
}: {
  logoClassName?: string | undefined;
  containerClassName?: string | undefined;
}) {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className={cn("mx-auto flex h-14 max-w-6xl items-center gap-8 px-5", containerClassName)}>
        <Link to={user ? "/dashboard" : "/"}>
          <Logo className={logoClassName} />
        </Link>

        {user ? (
          <div className="ml-auto flex shrink-0 items-center gap-3">
            <a href="/pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground">
              Pricing
            </a>
            <Link
              to="/inbox"
              title="Inbox"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground"
            >
              <Mail className="h-4 w-4" />
            </Link>
            <ProfileAvatarMenu />
          </div>
        ) : (
          <div className="ml-auto flex shrink-0 items-center gap-4">
            <Link
              to="/auth"
              search={{ mode: "signin", next: undefined }}
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Log In
            </Link>
            <Link to="/auth" search={{ mode: "signup", next: undefined }}>
              <Button size="sm" className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90">
                Create Account →
              </Button>
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
