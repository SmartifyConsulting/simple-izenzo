import { ChevronDown } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const NAV_MENUS: { label: string; items: { label: string; to: string }[] }[] = [
  {
    label: "Products",
    items: [
      { label: "Trade Desk", to: "/products/trade-desk" },
      { label: "Compliance Engine", to: "/products/compliance-engine" },
      { label: "Audit Ledger", to: "/products/audit-ledger" },
    ],
  },
  {
    label: "Solutions",
    items: [
      { label: "For Traders", to: "/solutions/traders" },
      { label: "For Trade Finance & Insurance", to: "/solutions/finance" },
      { label: "For Sovereigns & DFIs", to: "/solutions/sovereigns" },
    ],
  },
  {
    label: "Developers",
    items: [
      { label: "Docs", to: "/docs" },
      { label: "API Reference", to: "/docs/api" },
      { label: "Webhooks", to: "/docs/webhooks" },
      { label: "Status", to: "/status" },
    ],
  },
  {
    label: "Resources",
    items: [
      { label: "Pricing", to: "/pricing" },
      { label: "Walkthrough", to: "/walkthrough" },
    ],
  },
];

/** The marketing-site header, shared by the home page and every content page (Glossary, Contact Us…). */
export function SiteHeader({
  logoClassName,
  containerClassName,
}: {
  logoClassName?: string | undefined;
  containerClassName?: string | undefined;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className={cn("mx-auto flex h-14 max-w-6xl items-center gap-8 px-5", containerClassName)}>
        <Link to="/">
          <Logo className={logoClassName} />
        </Link>

        <nav className="hidden flex-1 items-center gap-6 md:flex">
          {NAV_MENUS.map((menu) => (
            <DropdownMenu key={menu.label}>
              <DropdownMenuTrigger className="flex items-center gap-1 text-sm font-medium text-muted-foreground outline-none hover:text-foreground">
                {menu.label}
                <ChevronDown className="h-3.5 w-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {menu.items.map((item) => (
                  <DropdownMenuItem key={item.to} asChild>
                    <Link to={item.to}>{item.label}</Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ))}
        </nav>

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
      </div>
    </header>
  );
}
