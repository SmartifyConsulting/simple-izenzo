import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Plus, Trash2 } from "lucide-react";
import { AvatarUpload } from "@/components/AvatarUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

const EMPTY_FORM = {
  name: "",
  registration_no: "",
  country: "",
  sector: "",
  address: "",
  offerings: "",
  website: "",
};

export function OrganisationsPanel() {
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
      offerings: o.offerings ?? "",
      website: o.website ?? "",
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

  async function onAvatarUploaded(orgId: string, url: string) {
    const { error } = await supabase.from("organisations").update({ avatar_url: url }).eq("id", orgId);
    if (error) {
      toast.error(error.message);
      return;
    }
    await refresh();
  }

  const showForm = creating || editingId;
  const editingOrg = editingId ? orgs.find((o) => o.id === editingId) : undefined;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold">Organizations</h2>
        <p className="text-xs text-muted-foreground">Every organisation attached to your seat</p>
      </div>

      {orgs.length > 0 && (
        <div className="space-y-3">
          {orgs.map((o) => (
            <div
              key={o.id}
              className="flex items-center justify-between rounded-md border border-border p-4"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                  {o.avatar_url ? (
                    <img src={o.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    o.name.slice(0, 2).toUpperCase()
                  )}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold">{o.name}</p>
                    {org?.id === o.id && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success">
                        <Check className="h-3 w-3" /> Active
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {[o.country, o.sector].filter(Boolean).join(" · ") || "No details yet"} ·{" "}
                    {o.credits} token{o.credits === 1 ? "" : "s"}
                  </p>
                </div>
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
            <h3 className="text-sm font-semibold">
              {editingId ? "Edit organisation" : "New organisation"}
            </h3>
            <p className="text-xs text-muted-foreground">
              These details are carried into every Proof of Intent and WaD case.
            </p>
          </div>

          {editingOrg && (
            <div className="border-b border-border px-5 py-4">
              <Label>Organisation logo</Label>
              <div className="mt-3">
                <AvatarUpload
                  url={editingOrg.avatar_url}
                  fallback={editingOrg.name.slice(0, 2).toUpperCase()}
                  folder="orgs"
                  ownerId={editingOrg.id}
                  onUploaded={(url) => onAvatarUploaded(editingOrg.id, url)}
                />
              </div>
            </div>
          )}

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
            <div className="space-y-1.5">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                type="url"
                placeholder="https://"
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
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
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="offerings">What does this organisation offer?</Label>
              <Textarea
                id="offerings"
                rows={4}
                placeholder="Describe the products or services you bid or offer with — commodities traded, capacity, certifications, typical terms…"
                value={form.offerings}
                onChange={(e) => setForm({ ...form, offerings: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Shown to counterparties evaluating a bid or offer from this organisation.
              </p>
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

      {editingOrg && <PortfolioSection orgId={editingOrg.id} />}
    </div>
  );
}

type PortfolioItem = { id: string; title: string; description: string | null; created_at: string };

function PortfolioSection({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: "", description: "" });
  const [busy, setBusy] = useState(false);

  const { data: items = [] } = useQuery({
    queryKey: ["portfolio", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("org_portfolio_items")
        .select("*")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as PortfolioItem[];
    },
  });

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.from("org_portfolio_items").insert({
        org_id: orgId,
        title: form.title,
        description: form.description || null,
      });
      if (error) throw error;
      setForm({ title: "", description: "" });
      await qc.invalidateQueries({ queryKey: ["portfolio", orgId] });
      toast.success("Added to portfolio");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    const { error } = await supabase.from("org_portfolio_items").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await qc.invalidateQueries({ queryKey: ["portfolio", orgId] });
  }

  return (
    <div className="rounded-md border border-border">
      <div className="border-b border-border px-5 py-3">
        <h3 className="text-sm font-semibold">Portfolio</h3>
        <p className="text-xs text-muted-foreground">
          Showcase specific products or services this organisation offers.
        </p>
      </div>

      {items.length > 0 && (
        <ul className="divide-y divide-border">
          {items.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="text-sm font-medium">{item.title}</p>
                {item.description && (
                  <p className="mt-0.5 text-sm text-muted-foreground">{item.description}</p>
                )}
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => remove(item.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={add} className="grid gap-3 p-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="pf-title">Product or service</Label>
          <Input
            id="pf-title"
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pf-desc">Description</Label>
          <Input
            id="pf-desc"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" size="sm" variant="outline" disabled={busy} className="gap-2">
            <Plus className="h-3.5 w-3.5" /> Add to portfolio
          </Button>
        </div>
      </form>
    </div>
  );
}
