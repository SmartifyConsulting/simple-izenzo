import { FileText } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/** Which document artefacts a step actually produces, keyed by the step's own spine key. Shown as
 * a small hoverable badge on the map and the stepper, so a person can see what comes out of a
 * stage without having to open it first. */
export const STEP_ARTEFACTS: Record<string, string[]> = {
  poi: ["Sealed Certificate", "POI Certificate"],
  wad: ["KYC", "KYB", "AML", "PEP"],
  "business-docs": ["NDA", "MOU", "SOW", "LOE"],
};

export function artefactsFor(step: string): string[] {
  return STEP_ARTEFACTS[step] ?? [];
}

/** A small icon that only renders when the given step actually produces artefacts — hovering it
 * lists them, without needing to open the step to find out. */
export function ArtefactHint({ step, className }: { step: string; className?: string }) {
  const artefacts = artefactsFor(step);
  if (artefacts.length === 0) return null;
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            // cursor-help overrides the not-allowed cursor a locked step's tile shows — reading
            // what a step produces should never look blocked just because the step itself is.
            className={className ?? "inline-flex shrink-0 cursor-help items-center text-primary/70 hover:text-primary"}
            aria-label={`Artefacts: ${artefacts.join(", ")}`}
          >
            <FileText className="h-3 w-3" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[220px]">
          <p className="text-[10px] font-semibold uppercase tracking-wide opacity-80">Artefacts</p>
          <p className="mt-0.5 text-xs">{artefacts.join(", ")}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
