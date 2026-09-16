import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { generateOrgBrief } from "@/lib/orgBrief.functions";
import { joinOrgByInviteCode } from "@/lib/orgInvite.functions";
import { toast } from "sonner";
import { Check, Copy, Pencil, Plus, Trash2, UserPlus } from "lucide-react";
import { AvatarUpload } from "@/components/AvatarUpload";
import { PublicListingToggle } from "@/components/account/PublicListingToggle";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
  industry: "",
  years_in_business: "",
  primary_contact_name: "",
  primary_contact_email: "",
  address: "",
  offerings: "",
  website: "",
  ai_brief: "",
};

/** The form keeps every field as a string for the inputs; the database wants a number (or null)
 * for years in business, and nulls rather than empty strings. */
function toRow(form: typeof EMPTY_FORM) {
  const years = form.years_in_business.trim();
  return {
    ...form,
    years_in_business: years === "" ? null : Number(years),
    primary_contact_name: form.primary_contact_name || null,
    primary_contact_email: form.primary_contact_email || null,
    industry: form.industry || null,
    ai_brief: form.ai_brief || null,
  };
}

export function OrganisationsPanel() {
  const { org, orgs, profile, refresh, switchOrg, loading } = useAuth();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [briefBusy, setBriefBusy] = useState(false);
  const writeBriefFn = useServerFn(generateOrgBrief);
  const [joining, setJoining] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [joinBusy, setJoinBusy] = useState(false);
  const joinOrgFn = useServerFn(joinOrgByInviteCode);

  async function joinOrg(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    setJoinBusy(true);
    try {
      const res = await joinOrgFn({ data: { code: inviteCode.trim() } });
      await refresh();
      setInviteCode("");
      setJoining(false);
      toast.success(
        res.alreadyMember ? `Switched to ${res.orgName}` : `Joined ${res.orgName} as a member`,
      );
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setJoinBusy(false);
    }
  }

  async function copyInviteCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Invite code copied — share it with a colleague to add them to this organisation.");
    } catch {
      toast.error("Could not copy — select and copy the code by hand.");
    }
  }

  /** Saves whatever is on screen first (so the website the user just typed is the one read), then
   * asks the AI for the brief and drops it straight into the form. */
  async function writeBrief(orgId: string) {
    setBriefBusy(true);
    try {
      const { error } = await supabase.from("organisations").update(toRow(form)).eq("id", orgId);
      if (error) throw error;
      const { brief, usedWebsite } = await writeBriefFn({ data: { orgId } });
      setForm((f) => ({ ...f, ai_brief: brief }));
      await refresh();
      toast.success(
        usedWebsite ? "Brief written from the company website" : "Brief written from the details captured",
      );
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBriefBusy(false);
    }
  }

  useEffect(() => {
    if (!loading && orgs.length === 0) setCreating(true);
  }, [loading, orgs.length]);

  function startEdit(o: (typeof orgs)[number]) {
    setEditingId(o.id);
    setCreating(false);
    setForm({
      name: o.name ?? "",
      registration_no: o.registration_no ?? "",
      country: o.country ?? "",
      sector: o.sector ?? "",
      industry: o.industry ?? "",
      years_in_business: o.years_in_business == null ? "" : String(o.years_in_business),
      primary_contact_name: o.primary_contact_name ?? "",
      primary_contact_email: o.primary_contact_email ?? "",
      address: o.address ?? "",
      offerings: o.offerings ?? "",
      website: o.website ?? "",
      ai_brief: o.ai_brief ?? "",
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
        const { error } = await supabase.from("organisations").update(toRow(form)).eq("id", editingId);
        if (error) throw error;
        toast.success("Organisation updated");
      } else {
        const { data, error } = await supabase
          .from("organisations")
          .insert(toRow(form))
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
      <div className="rounded-md border border-border">
        <div className="flex items-start justify-between p-5">
          <div>
            <h2 className="text-sm font-semibold">Organizations</h2>
            <p className="text-xs text-muted-foreground">Every organisation attached to your seat</p>
          </div>
          {!showForm && (
            <div className="flex shrink-0 items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => {
                  setJoining((v) => !v);
                  setInviteCode("");
                }}
              >
                <UserPlus className="h-3.5 w-3.5" /> Join with code
              </Button>
              <Button size="icon" variant="outline" className="h-8 w-8" onClick={startCreate}>
                <Plus className="h-4 w-4" />
                <span className="sr-only">Add organisation</span>
              </Button>
            </div>
          )}
        </div>

        {joining && !showForm && (
          <form onSubmit={joinOrg} className="flex flex-wrap items-end gap-2 border-t border-border p-5">
            <div className="min-w-0 flex-1 space-y-1.5">
              <Label htmlFor="invite-code">Invite code</Label>
              <Input
                id="invite-code"
                placeholder="e.g. 4F82A1C9"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Ask a colleague at the organisation you want to join for their invite code — found
                under their own Organizations settings.
              </p>
            </div>
            <Button type="submit" size="sm" disabled={joinBusy || !inviteCode.trim()}>
              {joinBusy ? "Joining…" : "Join"}
            </Button>
          </form>
        )}

        {orgs.length > 0 && (
          <div className="border-t border-border">
            {orgs.map((o) => (
              <div key={o.id} className="flex items-center justify-between p-5">
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
                      {[o.country, o.sector].filter(Boolean).join(" · ") || "No details yet"}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {o.credits} token{o.credits === 1 ? "" : "s"}
                    </p>
                    {o.invite_code && (
                      <button
                        type="button"
                        onClick={() => copyInviteCode(o.invite_code!)}
                        title="Copy invite code — share it with a colleague to add them to this organisation"
                        className="mt-1 flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-[11px] font-mono text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                      >
                        <Copy className="h-3 w-3 shrink-0" /> {o.invite_code}
                      </button>
                    )}
                    <Accordion type="single" collapsible className="mt-1">
                      <AccordionItem value="details" className="border-none">
                        <AccordionTrigger className="py-1 text-xs text-muted-foreground hover:no-underline">
                          Company profile
                        </AccordionTrigger>
                        <AccordionContent className="space-y-1 pb-2 text-xs text-muted-foreground">
                          <p>Industry: {o.industry || "Not captured"}</p>
                          <p>
                            Years in business:{" "}
                            {o.years_in_business == null ? "Not captured" : o.years_in_business}
                          </p>
                          <p>Country: {o.country || "Not captured"}</p>
                          <p>Primary contact: {o.primary_contact_name || "Not captured"}</p>
                          <p>Contact email: {o.primary_contact_email || "Not captured"}</p>
                          <p className="pt-1 text-foreground">
                            {o.ai_brief || "No company brief written yet."}
                          </p>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                    <PublicListingToggle orgId={o.id} />
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  {org?.id !== o.id && (
                    <Button size="sm" variant="outline" onClick={() => makeActive(o.id)}>
                      Set active
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => startEdit(o)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
            <div className="space-y-1.5">
              <Label htmlFor="industry">Industry</Label>
              <Input
                id="industry"
                value={form.industry}
                onChange={(e) => setForm({ ...form, industry: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="years">Years in business</Label>
              <Input
                id="years"
                type="number"
                min={0}
                value={form.years_in_business}
                onChange={(e) => setForm({ ...form, years_in_business: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact-name">Primary contact</Label>
              <Input
                id="contact-name"
                value={form.primary_contact_name}
                onChange={(e) => setForm({ ...form, primary_contact_name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact-email">Primary contact email</Label>
              <Input
                id="contact-email"
                type="email"
                value={form.primary_contact_email}
                onChange={(e) => setForm({ ...form, primary_contact_email: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="brief">About this company</Label>
                {editingId && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={briefBusy}
                    onClick={() => writeBrief(editingId)}
                  >
                    {briefBusy ? "Writing…" : form.ai_brief ? "Rewrite with AI" : "Write with AI"}
                  </Button>
                )}
              </div>
              <Textarea
                id="brief"
                rows={4}
                placeholder="A short description of the company. Save the website first, then let AI write this for you."
                value={form.ai_brief}
                onChange={(e) => setForm({ ...form, ai_brief: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Written from the company website and the details above. You can edit it freely.
              </p>
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
