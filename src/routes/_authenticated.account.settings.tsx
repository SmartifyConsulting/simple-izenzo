import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { AvatarUpload } from "@/components/AvatarUpload";
import { OrganisationsPanel } from "@/components/account/OrganisationsPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/account/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Izenzo" },
      { name: "description", content: "Your name, account details and organisations." },
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

  async function onAvatarUploaded(url: string) {
    if (!profile) return;
    const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", profile.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await refresh();
  }

  return (
    <AppShell title="Settings" description="Your name, account details and organisations">
      <div className="grid gap-6 lg:grid-cols-[380px_1fr] lg:items-start">
        <div className="space-y-6">
          <div className="rounded-md border border-border p-5">
            <h2 className="text-sm font-semibold">Profile picture</h2>
            <p className="text-xs text-muted-foreground">Shown across your account</p>
            <div className="mt-3">
              {profile && (
                <AvatarUpload
                  url={profile.avatar_url}
                  fallback={(profile.full_name ?? profile.email ?? "?").slice(0, 2).toUpperCase()}
                  folder="users"
                  ownerId={profile.id}
                  onUploaded={onAvatarUploaded}
                />
              )}
            </div>
          </div>

          <form onSubmit={save} className="space-y-4 rounded-md border border-border p-5">
            <div className="space-y-1.5">
              <Label htmlFor="full_name">Full name</Label>
              <Input id="full_name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={profile?.email ?? ""} disabled />
            </div>
            <Button type="submit" size="sm" disabled={busy}>
              Save
            </Button>
          </form>
        </div>

        <OrganisationsPanel />
      </div>
    </AppShell>
  );
}
