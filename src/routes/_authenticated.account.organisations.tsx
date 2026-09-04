import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Plus } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/account/organisations")({
  head: () => ({
    meta: [
      { title: "Organizations — Izenzo" },
      {
        name: "description",
        content: "The organisations attached to your seat: name, registration, domicile and sector.",
      },
    ],
  }),
  component: OrganisationsPage,
});

const EMPTY_FORM = { name: "", registration_no: "", country: "", sector: "", address: "" };

function OrganisationsPage() {
  const { org, orgs, profile, refresh, switchOrg } = useAuth();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(orgs.length === 0);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (orgs.length === 0) setCreating(true);
  }, [orgs.length]);

  function startEdit(o: (typeof orgs)[number]) {
    setEditingId(o.id);
    setCreating(false);
    setForm({
      name: o.name ?? "",
      registration_no: o.registration_no ?? "",
      country: o.country ?? "",
      sector: o.sector ?? "",
      address: o.address ?? "",
    });
  }

  function startCreate() {
    setEditingId(null);
    setCreating(true);
    setForm(EMPTY_FORM);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (editingId) {
        const { error } = await supabase.from("organisations").update(form).eq("id", editingId);
        if (error) throw error;
        toast.success("Organisation updated");
      } else {
        const { data, error } = await supabase
          .from("organisations")
          .insert(form)
          .select()
          .single();
        if (error) throw error;
        const { error: mErr } = await supabase
          .from("org_members")
          .insert({ org_id: data.id, user_id: profile!.id, role: "owner" });
        if (mErr) throw mErr;
        if (!org) {
          const { error: pErr } = await supabase
            .from("profiles")
            .update({ org_id: data.id })
            .eq("id", profile!.id);
          if (pErr) throw pErr;
        }
        toast.success("Organisation added");
      }
      await refresh();
      setEditingId(null);
      setCreating(false);
      setForm(EMPTY_FORM);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function makeActive(orgId: string) {
    try {
      await switchOrg(orgId);
      toast.success("Active organisation switched");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const showForm = creating || editingId;

  return (
    <AppShell title="Organizations" description="Every organisation attached to your seat">
      <div className="max-w-3xl space-y-6">
        {orgs.length > 0 && (
          <div className="space-y-3">
            {orgs.map((o) => (
              <div
                key={o.id}
                className="flex items-center justify-between rounded-md border border-border p-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold">{o.name}</p>
                    {org?.id === o.id && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success">
                        <Check className="h-3 w-3" /> Active
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {[o.country, o.sector].filter(Boolean).join(" · ") || "No details yet"} ·{" "}
                    {o.credits} token{o.credits === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {org?.id !== o.id && (
                    <Button size="sm" variant="outline" onClick={() => makeActive(o.id)}>
                      Set active
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => startEdit(o)}>
                    Edit
                  </Button>
                </div>
              </div>
            ))}
            {!showForm && (
              <Button size="sm" variant="outline" className="gap-2" onClick={startCreate}>
                <Plus className="h-3.5 w-3.5" /> Add organisation
              </Button>
            )}
          </div>
        )}

        {showForm && (
          <form onSubmit={save} className="rounded-md border border-border">
            <div className="border-b border-border px-5 py-3">
              <h2 className="text-sm font-semibold">
                {editingId ? "Edit organisation" : "New organisation"}
              </h2>
              <p className="text-xs text-muted-foreground">
                These details are carried into every Proof of Intent and WaD case.
              </p>
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="name">Registered name</Label>
                <Input
                  id="name"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg">Registration number</Label>
                <Input
                  id="reg"
                  value={form.registration_no}
                  onChange={(e) => setForm({ ...form, registration_no: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="country">Country of domicile</Label>
                <Input
                  id="country"
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sector">Sector</Label>
                <Input
                  id="sector"
                  value={form.sector}
                  onChange={(e) => setForm({ ...form, sector: e.target.value })}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="address">Registered address</Label>
                <Textarea
                  id="address"
                  rows={3}
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
              {orgs.length > 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditingId(null);
                    setCreating(false);
                  }}
                >
                  Cancel
                </Button>
              )}
              <Button type="submit" size="sm" disabled={busy}>
                {editingId ? "Save changes" : "Add organisation"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </AppShell>
  );
}
