import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/organisation")({
  head: () => ({
    meta: [
      { title: "Organisation details — Izenzo" },
      {
        name: "description",
        content: "The legal identity behind your seat: name, registration, domicile and sector.",
      },
      { property: "og:title", content: "Organisation details — Izenzo" },
      {
        property: "og:description",
        content: "The legal identity behind your Izenzo seat.",
      },
    ],
  }),
  component: OrganisationPage,
});

function OrganisationPage() {
  const { org, profile, refresh } = useAuth();
  const [form, setForm] = useState({
    name: "",
    registration_no: "",
    country: "",
    sector: "",
    address: "",
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (org) {
      setForm({
        name: org.name ?? "",
        registration_no: org.registration_no ?? "",
        country: org.country ?? "",
        sector: org.sector ?? "",
        address: org.address ?? "",
      });
    }
  }, [org]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (org) {
        const { error } = await supabase.from("organisations").update(form).eq("id", org.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("organisations")
          .insert(form)
          .select()
          .single();
        if (error) throw error;
        const { error: pErr } = await supabase
          .from("profiles")
          .update({ org_id: data.id })
          .eq("id", profile!.id);
        if (pErr) throw pErr;
      }
      await refresh();
      toast.success("Organisation saved");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="Organisation" description="The legal identity behind this seat">
      <form onSubmit={save} className="max-w-2xl space-y-6">
        <div className="rounded-md border border-border">
          <div className="border-b border-border px-5 py-3">
            <h2 className="text-sm font-semibold">Registered details</h2>
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
          <div className="flex items-center justify-between border-t border-border px-5 py-3">
            <p className="text-xs text-muted-foreground">
              {org ? `${org.credits} token${org.credits === 1 ? "" : "s"} held` : "No tokens yet"}
            </p>
            <Button type="submit" size="sm" disabled={busy}>
              Save details
            </Button>
          </div>
        </div>
      </form>
    </AppShell>
  );
}
