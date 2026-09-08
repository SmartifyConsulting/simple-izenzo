import { useNavigate, useRouterState } from "@tanstack/react-router";
import { LayoutGrid, ShieldAlert, TerminalSquare, Check, ChevronsUpDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const WORKSPACES = [
  { key: "trade-desk", label: "Trade Desk", blurb: "Operate live desk", icon: LayoutGrid, to: "/dashboard" as const, enabled: true },
  { key: "governance", label: "Governance Console", blurb: "Triage & adjudicate", icon: ShieldAlert, to: "/governance/triage" as const, enabled: true },
  { key: "developer", label: "Developer Centre", blurb: "Keys, webhooks, schema", icon: TerminalSquare, to: "/developer/keys" as const, enabled: true },
];

/** Mirrors compliance-matching.lovable.app's "Switch Workspace" menu — Trade Desk, Governance
 * Console, Developer Centre — each its own shell (SidebarShell, GovernanceShell,
 * DeveloperShell) reading real data scoped by the signed-in account's own RLS access. */
export function WorkspaceSwitcher({ current }: { current: string }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const activeKey = pathname.startsWith("/developer") ? "developer" : pathname.startsWith("/governance") ? "governance" : "trade-desk";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center justify-between gap-2 rounded-md border border-border px-2.5 py-2 text-left outline-none hover:bg-accent">
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{current}</span>
          <span className="block truncate text-[11px] text-muted-foreground">
            {WORKSPACES.find((w) => w.key === activeKey)?.blurb}
          </span>
        </span>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Switch workspace
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {WORKSPACES.map((w) => (
          <DropdownMenuItem
            key={w.key}
            disabled={!w.enabled}
            onClick={() => w.enabled && navigate({ to: w.to })}
            className={cn("flex items-start gap-2 py-2", !w.enabled && "opacity-50")}
          >
            <w.icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-sm font-medium">
                {w.label}
                {activeKey === w.key && <Check className="h-3 w-3 text-primary" />}
              </span>
              <span className="block text-xs text-muted-foreground">
                {w.enabled ? w.blurb : "Coming soon"}
              </span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
