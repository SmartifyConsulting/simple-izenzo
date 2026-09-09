import { useEffect, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, Coins, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { SearchButton } from "@/components/layout/SearchButton";
import { ProfileAvatarMenu } from "@/components/guided/ProfileAvatarMenu";
import { SiteFooter } from "@/components/layout/SiteFooter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { initTheme } from "@/lib/theme";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** Classic is the app's one committed view — no layout or view selector, just this shell. */
export function AppShell({
  title,
  description,
  actions,
  children,
  wide,
  pureBlack,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  wide?: boolean;
  /** Forces the page background to literal black instead of the theme's near-black
   * `--background`, for screens meant to sit flush with the header/nav's own black chrome. */
  pureBlack?: boolean;
}) {
  const { profile, org } = useAuth();
  const firstName = (profile?.full_name ?? profile?.email ?? "").split(/[\s@]/)[0];
  const width = wide ? "max-w-[1680px]" : "max-w-7xl";

  useEffect(() => {
    initTheme();
  }, []);

  return (
    <div
      className={cn("ink-grid flex min-h-screen flex-col", pureBlack ? "" : "bg-background")}
      style={pureBlack ? { backgroundColor: "#000" } : undefined}
    >
      <header className="sticky top-0 z-30 border-b border-border bg-background/70 backdrop-blur-xl">
        <div className={cn("mx-auto flex h-16 items-center gap-3 px-4 sm:px-6", width)}>
          <Link to="/dashboard" className="shrink-0">
            <Logo onDark className="h-7 w-auto" />
          </Link>
          <SearchButton />
          <div className="min-w-0 flex-1" />
          {org && (
            <Link
              to="/credits"
              search={{ returnTo: undefined }}

              title={`${org.credits} token${org.credits === 1 ? "" : "s"} — open Token Management`}
              className="flex h-6 shrink-0 items-center gap-1 rounded-full border border-primary/40 bg-primary/12 px-2 text-[11px] font-semibold text-primary transition-opacity hover:opacity-90"
            >
              <Coins className="h-3 w-3" />
              {org.credits}
            </Link>
          )}
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
      </header>

      <main className={cn("mx-auto w-full flex-1 px-4 pb-14 sm:px-6", width, wide ? "pt-3" : "pt-5")}>
        <div
          className={cn(
            "grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4",
            wide ? "mb-2" : "mb-4",
          )}
        >
          <div className="min-w-0">
            {firstName && (
              <p
                className={cn(
                  "truncate leading-[1.15] tracking-tight",
                  wide
                    ? "text-[1.15rem] sm:text-[1.3rem]"
                    : "text-[1.75rem] sm:text-[2rem]",
                )}
                style={{ fontFamily: "var(--font-greeting)", fontWeight: 700 }}
              >
                {greeting()}, {firstName}
              </p>
            )}
            {title && (
              <h1 className="mt-2 truncate text-sm font-semibold tracking-tight text-muted-foreground">
                {title}
              </h1>
            )}
            {description && (
              <p className="mt-1 truncate text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          {actions && <div>{actions}</div>}
        </div>
        {children}
      </main>

      <SiteFooter />
    </div>
  );

}
