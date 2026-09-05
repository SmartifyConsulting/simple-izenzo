import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Lock, Circle, Dot, ChevronRight } from "lucide-react";
import { SPINE, lockReason, stepIndex, type StageKey } from "@/lib/spine";
import type { Transaction } from "@/lib/tx";
import { cn } from "@/lib/utils";

export function SpineRail({
  tx,
  currentStage,
  currentStep,
}: {
  tx: Transaction;
  currentStage: string;
  currentStep: string;
}) {
  const currentIdx = stepIndex(tx.stage, tx.step);
  const viewingIdx = stepIndex(currentStage, currentStep);
  const [openStages, setOpenStages] = useState<Set<string>>(() => new Set([currentStage, tx.stage]));

  // Auto-expand whichever gate is being viewed, or is the transaction's active gate —
  // e.g. arriving via a nav link straight into a gate opens it without an extra click.
  useEffect(() => {
    setOpenStages((prev) => {
      if (prev.has(currentStage) && prev.has(tx.stage)) return prev;
      const next = new Set(prev);
      next.add(currentStage);
      next.add(tx.stage);
      return next;
    });
  }, [currentStage, tx.stage]);

  function isGateComplete(stageKey: string) {
    const def = SPINE.find((s) => s.key === stageKey);
    if (!def) return true;
    const lastIdx = stepIndex(stageKey, def.steps[def.steps.length - 1]!.key);
    return currentIdx > lastIdx;
  }

  function toggleStage(stageKey: string, isOpen: boolean) {
    // The transaction's active, unfinished gate stays expanded until every step in it
    // is complete — it can't be collapsed away by accident.
    if (isOpen && stageKey === tx.stage && !isGateComplete(stageKey)) return;
    setOpenStages((prev) => {
      const next = new Set(prev);
      if (isOpen) next.delete(stageKey);
      else next.add(stageKey);
      return next;
    });
  }

  return (
    <nav className="lg:sticky lg:top-20">
      <p className="label-caps px-1">Trading Gateway</p>
      <ol className="mt-4 space-y-6">
        {SPINE.map((stage) => {
          const locked = lockReason(stage.key as StageKey, stage.steps[0]!.key, tx);
          const isOpen = openStages.has(stage.key);
          return (
            <li key={stage.key}>
              <button
                type="button"
                onClick={() => toggleStage(stage.key, isOpen)}
                className="flex w-full items-center gap-1.5 px-1 text-left"
              >
                <ChevronRight
                  className={cn(
                    "h-3 w-3 shrink-0 text-muted-foreground transition-transform",
                    isOpen && "rotate-90",
                  )}
                />
                <span
                  className={cn(
                    "text-[11px] font-semibold uppercase tracking-[0.09em]",
                    tx.stage === stage.key ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {stage.label}
                </span>
                {locked && <Lock className="h-3 w-3 text-muted-foreground" />}
              </button>
              {isOpen && (
              <ul className="mt-2 border-l border-border">
                {stage.steps.map((step) => {
                  const idx = stepIndex(stage.key, step.key);
                  const done = currentIdx > idx;
                  const isCurrent = viewingIdx === idx;
                  const reason = lockReason(stage.key as StageKey, step.key, tx);
                  const disabled = Boolean(reason) && !done;

                  const inner = (
                    <span
                      className={cn(
                        "group -ml-px flex items-center gap-2 border-l-2 py-2 pl-3.5 pr-2 text-sm transition-colors",
                        isCurrent
                          ? "border-foreground font-medium text-foreground"
                          : "border-transparent text-muted-foreground",
                        !disabled && !isCurrent && "hover:border-border hover:text-foreground",
                        disabled && "opacity-55",
                      )}
                      title={reason ?? undefined}
                    >
                      {done ? (
                        <Check className="h-3.5 w-3.5 shrink-0 text-success" />
                      ) : disabled ? (
                        <Lock className="h-3 w-3 shrink-0" />
                      ) : isCurrent ? (
                        <Circle className="h-2.5 w-2.5 shrink-0 fill-foreground" />
                      ) : (
                        <Dot className="h-3.5 w-3.5 shrink-0" />
                      )}
                      <span className="truncate">{step.label}</span>
                    </span>
                  );

                  if (disabled) {
                    return (
                      <li key={step.key} className="cursor-not-allowed">
                        {inner}
                      </li>
                    );
                  }
                  return (
                    <li key={step.key}>
                      <Link
                        to="/tx/$id/$stage/$step"
                        params={{ id: tx.id, stage: stage.key, step: step.key }}
                        className="block"
                      >
                        {inner}
                      </Link>
                    </li>
                  );
                })}
              </ul>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
