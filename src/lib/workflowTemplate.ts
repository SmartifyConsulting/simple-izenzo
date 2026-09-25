import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { SPINE, type StageDef } from "@/lib/spine";

type TemplateRow = {
  key: string;
  stages: { key: string; steps: string[] }[];
  lexicon: Record<string, string>;
};

const db = supabase as unknown as { from: (t: string) => any };

/** The workflow template assigned to the signed-in user's organisation. Gate order is fixed;
 * only step order inside a gate and wording change. Falls back to the default Izenzo map. */
export function useWorkflowTemplate() {
  const { org } = useAuth();
  const { data } = useQuery({
    queryKey: ["org-workflow-template", org?.id],
    enabled: Boolean(org?.id),
    staleTime: 60_000,
    queryFn: async () => {
      const { data: o } = await db.from("organisations").select("workflow_template_key").eq("id", org!.id).maybeSingle();
      const key = (o?.workflow_template_key as string | null) ?? "izenzo_default";
      const { data: t } = await db.from("workflow_templates").select("key,stages,lexicon").eq("key", key).maybeSingle();
      return (t ?? null) as TemplateRow | null;
    },
  });

  const lexicon = data?.lexicon ?? {};
  const spine: StageDef[] = SPINE.map((stage) => {
    const order = data?.stages?.find((s) => s.key === stage.key)?.steps;
    const steps = order
      ? [
          ...order.map((k) => stage.steps.find((s) => s.key === k)).filter((s): s is StageDef["steps"][number] => Boolean(s)),
          ...stage.steps.filter((s) => !order.includes(s.key)),
        ]
      : stage.steps;
    return { ...stage, steps: steps.map((s) => ({ ...s, label: relabel(s.label, lexicon) })) };
  });
  return { templateKey: data?.key ?? "izenzo_default", lexicon, spine, relabel: (t: string) => relabel(t, lexicon) };
}

const DEFAULT_WORDS: Record<string, string> = {
  bid: "Bid",
  poi: "Seal Intent",
  deal: "Deal",
  bidder: "Bidder",
  intent: "Intent",
  counterparty: "Counterparty",
};

function relabel(text: string, lexicon: Record<string, string>) {
  let out = text;
  // Longest phrases first so "Seal Intent" is replaced before "Intent".
  for (const k of Object.keys(DEFAULT_WORDS).sort((a, b) => DEFAULT_WORDS[b]!.length - DEFAULT_WORDS[a]!.length)) {
    const to = lexicon[k];
    const from = DEFAULT_WORDS[k]!;
    if (!to || to === from) continue;
    out = out.replace(new RegExp(`\\b${from}(s?)\\b`, "g"), (_m, s: string) => to + s);
  }
  return out;
}
