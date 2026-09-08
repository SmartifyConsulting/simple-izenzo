import { useNavigate, useRouterState } from "@tanstack/react-router";
import { LayoutGrid, Waypoints, GitBranch, Grid3x3, Check, ChevronsUpDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const VIEWS = [
  { key: "classic", label: "Classic", blurb: "Full nav, step by step", icon: LayoutGrid, to: "/dashboard" as const },
  { key: "guided", label: "Simple Mode", blurb: "Flight-search style, one form", icon: Waypoints, to: "/guided" as const },
  { key: "workflow", label: "Workflow View", blurb: "The gate flowchart, your step highlighted", icon: GitBranch, to: "/workflow" as const },
  { key: "workflow-grid", label: "Workflow Grid", blurb: "The same flowchart, on its grid backdrop", icon: Grid3x3, to: "/workflow-grid" as const },
];

/** Lets the user jump between the four Trade Desk views — Classic, Simple Mode, Workflow View,
 * Workflow Grid — from any of them, not just the two the pre-existing "Switch to Version 1"
 * button covered. */
export function ViewSwitcher({ variant = "compact" }: { variant?: "block" | "compact" }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const activeKey = pathname.startsWith("/guided")
    ? "guided"
    : pathname.startsWith("/workflow-grid")
      ? "workflow-grid"
      : pathname.startsWith("/workflow")
        ? "workflow"
        : "classic";
  const activeView = VIEWS.find((v) => v.key === activeKey)!;

  return (
    <DropdownMenu>
      {variant === "compact" ? (
        <DropdownMenuTrigger className="flex shrink-0 items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground outline-none hover:text-foreground">
          <activeView.icon className="h-3.5 w-3.5" />
          {activeView.label}
          <ChevronsUpDown className="h-3 w-3" />
        </DropdownMenuTrigger>
      ) : (
        <DropdownMenuTrigger className="flex w-full items-center justify-between gap-2 rounded-md border border-border px-2.5 py-2 text-left outline-none hover:bg-accent">
          <span className="flex min-w-0 items-center gap-2">
            <activeView.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate text-sm font-medium">{activeView.label}</span>
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </DropdownMenuTrigger>
      )}
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Switch view
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {VIEWS.map((v) => (
          <DropdownMenuItem
            key={v.key}
            onClick={() => navigate({ to: v.to })}
            className={cn("flex items-start gap-2 py-2")}
          >
            <v.icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-sm font-medium">
                {v.label}
                {activeKey === v.key && <Check className="h-3 w-3 text-primary" />}
              </span>
              <span className="block text-xs text-muted-foreground">{v.blurb}</span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
