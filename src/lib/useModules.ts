import {
  Coins,
  Inbox,
  ShieldCheck,
  LayoutDashboard,
  Building2,
  Search,
  LifeBuoy,
  ShieldAlert,
  Banknote,
  TerminalSquare,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth";

export type ModuleTo =
  | "/dashboard"
  | "/inbox"
  | "/credits"
  | "/registry"
  | "/facilitation"
  | "/support"
  | "/developer/keys"
  | "/auditor"
  | "/funder"
  | "/admin";

export type ModuleDef = { to: ModuleTo; label: string; icon: LucideIcon; blurb: string };

/** The classic shell's "Modules" launcher list — shared with the Simple Mode showcase so both
 * surfaces stay in sync. */
export function useModules(): ModuleDef[] {
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const isAuditor = roles.includes("auditor") || isAdmin;
  const isFunder = roles.includes("funder") || isAdmin;

  const modules: ModuleDef[] = [
    { to: "/dashboard", label: "Deals", icon: LayoutDashboard, blurb: "Every live deal canvas" },
    { to: "/inbox", label: "Inbox", icon: Inbox, blurb: "Requests waiting on you" },
    { to: "/credits", label: "Tokens", icon: Coins, blurb: "Balance and top-ups" },
    { to: "/registry", label: "Registry", icon: Building2, blurb: "Known businesses" },
    {
      to: "/facilitation",
      label: "Search Party",
      icon: Search,
      blurb: "Find and surface a party",
    },
    { to: "/support", label: "Support", icon: LifeBuoy, blurb: "Talk to us" },
    { to: "/developer/keys", label: "Developer Centre", icon: TerminalSquare, blurb: "Keys, webhooks, schema" },
  ];
  if (isFunder)
    modules.push({ to: "/funder", label: "Funder", icon: Banknote, blurb: "Funding positions" });
  if (isAuditor)
    modules.push({
      to: "/auditor",
      label: "Auditor",
      icon: ShieldAlert,
      blurb: "Read-only assurance",
    });
  if (isAdmin)
    modules.push({ to: "/admin", label: "Admin", icon: ShieldCheck, blurb: "People and platform" });
  return modules;
}
