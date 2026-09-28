import { STEP_GOVERNANCE, canSeeGovernance } from "@/lib/stepGovernance";
import { useAuth } from "@/lib/auth";

export function GovernanceCard({ stage, step, force }: { stage: string; step: string; force?: boolean }) {
  const { user } = useAuth() as { user?: { email?: string | null } | null };
  const g = STEP_GOVERNANCE[`${stage}/${step}`];
  if (!g || (!force && !canSeeGovernance(user?.email))) return null;
  const rows: [string, string][] = [
    ["Responsible", g.responsible],
    ["Input required", g.inputs],
    ["Output", g.output],
    ["Template", g.template ?? "None"],
    ["Compulsory before next step", g.gate],
  ];
  return (
    <div className="rounded-md border border-border bg-muted/40 p-3 text-xs">
      <dl className="grid gap-1.5 sm:grid-cols-[180px_1fr]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="font-medium text-muted-foreground">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
