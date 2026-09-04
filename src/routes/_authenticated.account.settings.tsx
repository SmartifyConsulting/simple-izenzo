import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/account/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Izenzo" },
      { name: "description", content: "Your name and account details." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { profile, refresh } = useAuth();
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setFullName(profile?.full_name ?? "");
  }, [profile]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName })
        .eq("id", profile.id);
      if (error) throw error;
      await refresh();
      toast.success("Settings saved");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="Settings" description="Your name and account details">
      <form onSubmit={save} className="max-w-md space-y-4 rounded-md border border-border p-5">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={profile?.email ?? ""} disabled />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="full_name">Full name</Label>
          <Input id="full_name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <Button type="submit" size="sm" disabled={busy}>
          Save
        </Button>
      </form>
    </AppShell>
  );
}
