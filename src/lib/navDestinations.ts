import {
  LayoutDashboard,
  Search,
  Building2,
  ArrowLeftRight,
  ShieldCheck,
  CreditCard,
  Settings,
  Bell,
  type LucideIcon,
} from "lucide-react";

export type NavDestination = {
  to: string;
  label: string;
  icon: LucideIcon;
  blurb: string;
};

/** The full set of authenticated destinations. Shared by the detailed sidebar nav
 * (SidebarShell) and the simplified, icon-driven guided canvas (routes/_authenticated.guided.tsx)
 * so both navigation styles always point at the same places. */
export const NAV_DESTINATIONS: NavDestination[] = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard, blurb: "Your live deal canvas" },
  { to: "/discover", label: "Counterparties", icon: Search, blurb: "Find and verify a party to trade with" },
  { to: "/registry", label: "Company Register", icon: Building2, blurb: "Known businesses on file" },
  { to: "/dashboard", label: "My Trades", icon: ArrowLeftRight, blurb: "Every deal you're working on" },
  { to: "/account/settings", label: "Compliance", icon: ShieldCheck, blurb: "Your KYB and governance record" },
  { to: "/credits", label: "Billing", icon: CreditCard, blurb: "Token balance and top-ups" },
  { to: "/account/settings", label: "Settings", icon: Settings, blurb: "Account and organisation details" },
  { to: "/inbox", label: "Notifications", icon: Bell, blurb: "Requests waiting on you" },
];
