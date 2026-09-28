import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Copy, GitBranch, GripVertical, Lock, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { stepDef } from "@/lib/spine";
import { GovernanceCard } from "@/components/steps/GovernanceCard";

type Stage = { key: string; label: string; steps: string[] };
type Template = {
  key: string;
  name: string;
  description: string | null;
  domain: string;
  is_default: boolean;
  locked: boolean;
  stages: Stage[];
  lexicon: Record<string, string>;
};

// The five gates and their order are the Izenzo spine — fixed in every template.
const db = supabase as unknown as { from: (t: string) => any };
const GATE_COLORS = ["#0094DA", "#B0292F", "#0C9E8B", "#293E6B", "#EDB717"];

export function WorkflowTemplatesTab() {
  const qc = useQueryClient();
  const { data: templates = [] } = useQuery({
    queryKey: ["workflow-templates"],
    queryFn: async () => {
      const { data, error } = await db.from("workflow_templates").select("*").order("is_default", { ascending: false });
      if (error) throw error;
      return data as Template[];
    },
  });
  const { data: orgs = [] } = useQuery({
    queryKey: ["workflow-template-orgs"],
    queryFn: async () => {
      const { data, error } = await db.from("organisations").select("id,name,workflow_template_key").order("name");
      if (error) throw error;
      return data as { id: string; name: string; workflow_template_key: string | null }[];
    },
  });
  const [selected, setSelected] = useState<string>("izenzo_default");
  const current = templates.find((t) => t.key === selected) ?? templates[0];
  const [draft, setDraft] = useState<Template | null>(null);
  const [openGates, setOpenGates] = useState<Record<string, boolean>>({});
  const [openSteps, setOpenSteps] = useState<Record<string, boolean>>({});
  useEffect(() => setDraft(current ? structuredClone(current) : null), [current]);

  async function duplicate() {
    if (!current) return;
    const key = `custom_${Date.now()}`;
    const { error } = await db.from("workflow_templates").insert({
      key, name: `${current.name} (copy)`, description: current.description, domain: current.domain,
      stages: current.stages, lexicon: current.lexicon, is_default: false, locked: false,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Template copied");
    await qc.invalidateQueries({ queryKey: ["workflow-templates"] });
    setSelected(key);
  }

  async function save() {
    if (!draft) return;
    const { error } = await db.from("workflow_templates")
      .update({ name: draft.name, stages: draft.stages, lexicon: draft.lexicon })
      .eq("key", draft.key);
    if (error) { toast.error(error.message); return; }
    toast.success("Template saved");
    await qc.invalidateQueries({ queryKey: ["workflow-templates"] });
  }

  function move(si: number, i: number, dir: -1 | 1) {
    if (!draft) return;
    const next = structuredClone(draft);
    const steps = next.stages[si]!.steps;
    const j = i + dir;
    if (j < 0 || j >= steps.length) return;
    [steps[i], steps[j]] = [steps[j]!, steps[i]!];
    setDraft(next);
  }

  async function assign(orgId: string, key: string) {
    const { error } = await db.from("organisations").update({ workflow_template_key: key }).eq("id", orgId);
    if (error) { toast.error(error.message); return; }
    toast.success("Template assigned");
    await qc.invalidateQueries({ queryKey: ["workflow-template-orgs"] });
  }

  const readOnly = !draft || draft.locked;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={current?.key ?? ""} onValueChange={setSelected}>
          <SelectTrigger className="w-72"><SelectValue placeholder="Choose a template" /></SelectTrigger>
          <SelectContent>
            {templates.map((t) => <SelectItem key={t.key} value={t.key}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={duplicate}><Copy className="mr-1.5 h-4 w-4" />Copy as new template</Button>
        {!readOnly && <Button onClick={save}><Save className="mr-1.5 h-4 w-4" />Save</Button>}
        {draft?.locked && <Badge variant="secondary"><Lock className="mr-1 h-3 w-3" />Locked default</Badge>}
      </div>

      {draft && (
        <>
          <p className="text-sm text-muted-foreground">{draft.description}</p>
          {!readOnly && (
            <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="max-w-md" />
          )}

          <div className="overflow-hidden rounded-lg border border-border">
            <div className="flex items-center justify-between bg-foreground px-4 py-3 text-background">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <GitBranch className="h-4 w-4" />Stage Gates &amp; Activities
              </span>
              <span className="text-xs opacity-80">{draft.stages.reduce((n, s) => n + s.steps.length, 0)} steps</span>
            </div>
            <div className="divide-y divide-border bg-card">
              {draft.stages.map((stage, si) => {
                const open = openGates[stage.key] ?? si === 0;
                const color = GATE_COLORS[si % GATE_COLORS.length];
                return (
                  <div key={stage.key}>
                    <button type="button" onClick={() => setOpenGates({ ...openGates, [stage.key]: !open })}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50">
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
                      <span className="font-medium">{si + 1}. {stage.label}</span>
                      <Badge variant="secondary" className="ml-1">{stage.steps.length} {stage.steps.length === 1 ? "activity" : "activities"}</Badge>
                    </button>
                    {open && (
                      <div className="space-y-2 bg-muted/20 px-4 pb-4 pl-14">
                        {stage.steps.map((s, i) => {
                          const id = `${stage.key}/${s}`;
                          const so = openSteps[id] ?? false;
                          return (
                            <div key={s} className="rounded-md border border-border bg-card">
                              <div className="flex items-center gap-2 px-3 py-2 text-sm">
                                <button type="button" className="flex flex-1 items-center gap-2 text-left"
                                  onClick={() => setOpenSteps({ ...openSteps, [id]: !so })}>
                                  {so ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                  <span className="text-xs text-muted-foreground">{i + 1}</span>
                                  <span>{stepDef(stage.key, s)?.label ?? s}</span>
                                </button>
                                {!readOnly && (
                                  <span className="flex gap-1">
                                    <button type="button" onClick={() => move(si, i, -1)} aria-label="Move up"><ArrowUp className="h-3.5 w-3.5" /></button>
                                    <button type="button" onClick={() => move(si, i, 1)} aria-label="Move down"><ArrowDown className="h-3.5 w-3.5" /></button>
                                  </span>
                                )}
                              </div>
                              {so && <div className="px-3 pb-3"><GovernanceCard stage={stage.key} step={s} force /></div>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="glass-node p-4">
            <p className="label-caps mb-3">Wording</p>
            <div className="grid gap-3 md:grid-cols-3">
              {Object.entries(draft.lexicon).map(([k, v]) => (
                <label key={k} className="text-xs text-muted-foreground">
                  {k}
                  <Input disabled={readOnly} value={v}
                    onChange={(e) => setDraft({ ...draft, lexicon: { ...draft.lexicon, [k]: e.target.value } })} />
                </label>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            The five gates and their order always stay the same. Sealed Intent and Without a Doubt stay mandatory in every template.
          </p>
        </>
      )}

      <div className="glass-node p-4">
        <p className="label-caps mb-3">Template per organisation</p>
        <div className="space-y-2">
          {orgs.map((o) => (
            <div key={o.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate">{o.name}</span>
              <Select value={o.workflow_template_key ?? "izenzo_default"} onValueChange={(v) => assign(o.id, v)}>
                <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {templates.map((t) => <SelectItem key={t.key} value={t.key}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
