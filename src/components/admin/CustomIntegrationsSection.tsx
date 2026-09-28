import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

type Row = {
  id: string;
  name: string;
  summary: string;
  docs_url: string | null;
  console_url: string | null;
  top_up_url: string | null;
};

const EMPTY = { name: "", summary: "", docs_url: "", console_url: "", top_up_url: "" };

/** Admin CRUD for services that aren't in the built-in catalogue. */
export function CustomIntegrationsSection() {
  const qc = useQueryClient();
  const { data: rows = [] } = useQuery({
    queryKey: ["custom-integrations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integration_custom_providers")
        .select("id, name, summary, docs_url, console_url, top_up_url")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: ["custom-integrations"] });

  function open(row?: Row) {
    setEditing(row ? row.id : "new");
    setForm(
      row
        ? { name: row.name, summary: row.summary, docs_url: row.docs_url ?? "", console_url: row.console_url ?? "", top_up_url: row.top_up_url ?? "" }
        : EMPTY,
    );
  }

  async function save(): Promise<void> {
    if (!form.name.trim()) { toast.error("Give the service a name."); return; }
    setBusy(true);
    const payload = {
      name: form.name.trim(),
      summary: form.summary.trim(),
      docs_url: form.docs_url.trim() || null,
      console_url: form.console_url.trim() || null,
      top_up_url: form.top_up_url.trim() || null,
    };
    const { error } =
      editing === "new"
        ? await supabase.from("integration_custom_providers").insert({ ...payload, id: `custom-${payload.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(36)}` })
        : await supabase.from("integration_custom_providers").update(payload).eq("id", editing!);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editing === "new" ? "Service added" : "Service updated");
    setEditing(null);
    refresh();
  }

  async function remove(row: Row): Promise<void> {
    if (!window.confirm(`Delete ${row.name}?`)) return;
    const { error } = await supabase.from("integration_custom_providers").delete().eq("id", row.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`${row.name} deleted`);
    refresh();
  }

  return (
    <div className="space-y-3 border-t border-border pt-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Custom services</h3>
        <Button size="sm" onClick={() => open()}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Add service
        </Button>
      </div>

      {editing && (
        <div className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-2">
          {(
            [
              ["name", "Name"],
              ["summary", "What it does"],
              ["docs_url", "Docs link"],
              ["console_url", "Console link"],
              ["top_up_url", "Top-up link"],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="space-y-1.5">
              <Label htmlFor={`ci-${key}`}>{label}</Label>
              <Input id={`ci-${key}`} value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} />
            </div>
          ))}
          <div className="flex items-end gap-2 sm:col-span-2">
            <Button size="sm" onClick={save} disabled={busy}>Save</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">No custom services yet.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold">{r.name}</p>
                {r.summary && <p className="truncate text-[11px] text-muted-foreground">{r.summary}</p>}
              </div>
              <div className="flex shrink-0 gap-1">
                <Button size="sm" variant="outline" onClick={() => open(r)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove(r)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
