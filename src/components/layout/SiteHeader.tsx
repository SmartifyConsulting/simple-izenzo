import { Link } from "@tanstack/react-router";
import { ChevronDown, Mail } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { SearchButton } from "@/components/layout/SearchButton";
import { ProfileAvatarMenu } from "@/components/guided/ProfileAvatarMenu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

/** The site header, shared by the home page, every marketing/content page (Glossary, Contact
 * Us…) and, once signed in, the same nav carries Search/Inbox/Profile — same as the app shell. */
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
            <SearchButton />
            <nav className="flex shrink-0 items-center gap-4 text-sm font-medium text-muted-foreground">
              <a href="/pricing" className="hover:text-foreground">
                Pricing
              </a>
              <Link to="/docs" className="hover:text-foreground">
                API's
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-1 outline-none hover:text-foreground">
                  Report
                  <ChevronDown className="h-3.5 w-3.5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem asChild>
                    <Link to="/trades">All Deals</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/credits" search={{ returnTo: undefined }}>
                      Token Management
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Link to="/support" className="hover:text-foreground">
                Support
              </Link>
            </nav>
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
