import { Check, Lock, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type NodeState = "done" | "active" | "open" | "locked";

export function CanvasNode({
  label,
  blurb,
  state,
  icon: Icon,
  side,
  note,
  delay = 0,
  onClick,
  compact,
}: {
  label: string;
  blurb?: string | undefined;
  state: NodeState;
  icon?: LucideIcon | undefined;
  side?: "left" | "right" | "center" | undefined;
  note?: string | undefined;
  delay?: number | undefined;
  onClick?: (() => void) | undefined;
  compact?: boolean | undefined;
}) {
  const locked = state === "locked";
  return (
    <button
      type="button"
      disabled={locked}
      onClick={onClick}
      style={{ animationDelay: `${delay}ms` }}
      className={cn(
        "glass-node group w-full text-left",
        state === "active" ? "animate-node-rise-active" : "animate-node-rise",
        compact ? "px-3.5 py-3" : "px-4 py-4",
        locked
          ? "node-locked cursor-not-allowed"
          : "hover:-translate-y-0.5 hover:border-primary/50",
        state === "active" && "node-active",
        state === "done" && "node-done",
        side === "right" && "text-right",
      )}
    >
      <span
        className={cn(
          "flex items-center gap-2",
          side === "right" && "flex-row-reverse",
          side === "center" && "justify-center",
        )}
      >
        <span
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px]",
            state === "done"
              ? "border-primary/50 bg-primary/15 text-primary"
              : state === "active"
                ? "border-primary bg-primary/20 text-primary animate-signal-pulse"
                : "border-border bg-muted text-muted-foreground",
          )}
        >
          {state === "done" ? (
            <Check className="h-3.5 w-3.5" />
          ) : locked ? (
            <Lock className="h-3 w-3" />
          ) : Icon ? (
            <Icon className="h-3.5 w-3.5" />
          ) : (
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
          )}
        </span>
        <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold tracking-tight">
          {label}
        </span>
      </span>
      {blurb && !compact && (
        <span className="mt-1.5 block text-[12px] leading-relaxed text-muted-foreground">
          {blurb}
        </span>
      )}
      {note && (
        <span className="mt-2 inline-block rounded-full bg-primary/12 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-primary">
          {note}
        </span>
      )}
    </button>
  );
}

export function Connector({ pulse }: { pulse?: boolean }) {
  return (
    <div className="flex justify-center py-1.5" aria-hidden>
      <span
        className={cn(
          "h-6 w-px bg-gradient-to-b from-transparent via-primary/50 to-transparent",
          pulse && "animate-signal-pulse",
        )}
      />
    </div>
  );
}

export function GateBar({ label, cleared }: { label: string; cleared: boolean }) {
  return (
    <div className="my-5 flex items-center gap-3" aria-hidden>
      <span className="h-px flex-1 bg-gradient-to-r from-transparent to-border" />
      <span
        className={cn(
          "rounded-full border px-3 py-1 text-[10.5px] font-semibold uppercase tracking-[0.12em]",
          cleared
            ? "border-primary/50 bg-primary/12 text-primary"
            : "border-border bg-muted text-muted-foreground",
        )}
      >
        {cleared ? `${label} · cleared` : `${label} · sealed shut`}
      </span>
      <span className="h-px flex-1 bg-gradient-to-l from-transparent to-border" />
    </div>
  );
}

export function SearchBeam({ active }: { active: boolean }) {
  return (
    <div className="relative my-3 h-12 overflow-hidden rounded-2xl border border-border bg-muted/40">
      <div className="absolute inset-y-0 left-0 right-0 flex items-center">
        <span className="h-px w-full bg-gradient-to-r from-transparent via-primary/45 to-transparent" />
      </div>
      {active && (
        <div className="animate-beam-sweep absolute inset-y-0 left-1/2 w-40 -translate-x-1/2 bg-gradient-to-r from-transparent via-primary/35 to-transparent blur-md" />
      )}
      <p className="relative flex h-full items-center justify-center text-[11px] font-semibold uppercase tracking-[0.14em] text-primary/80">
        AI · AI+ matching
      </p>
    </div>
  );
}
