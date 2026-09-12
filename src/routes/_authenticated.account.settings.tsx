import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { AvatarUpload } from "@/components/AvatarUpload";
import { OrganisationsPanel } from "@/components/account/OrganisationsPanel";
import { VerificationPanel } from "@/components/verification/VerificationPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const [first = "", ...rest] = (profile?.full_name ?? "").trim().split(/\s+/).filter(Boolean);
    setFirstName(first);
    setLastName(rest.join(" "));
  }, [profile]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: [firstName.trim(), lastName.trim()].filter(Boolean).join(" ") })
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
    <AppShell title="Settings & Identity" description="Manage your profile, company verification status, notification preferences, and credit balance.">
      <Tabs defaultValue="profile">
        <TabsList className="flex-wrap">
          <TabsTrigger value="profile">My Profile</TabsTrigger>
          <TabsTrigger value="kyb">Organisations</TabsTrigger>
          <TabsTrigger value="data">My Data</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-6">
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
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="first_name">First name</Label>
                    <Input id="first_name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="last_name">Last name</Label>
                    <Input id="last_name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email address</Label>
                  <Input id="email" value={profile?.email ?? ""} disabled />
                  <p className="text-xs text-muted-foreground">
                    Your sign-in identity. Contact support to change.
                  </p>
                </div>
                <Button type="submit" size="sm" disabled={busy}>
                  Save changes
                </Button>
              </form>

              <div className="space-y-3 rounded-md border border-border p-5">
                <h2 className="text-sm font-semibold">Reset password</h2>
                <p className="text-sm text-muted-foreground">
                  Reset your password by email — you'll be signed out of this device once it's
                  changed.
                </p>
                <a href="/forgot-password">
                  <Button size="sm" variant="outline">
                    Send password reset link
                  </Button>
                </a>
              </div>
            </div>

            <div className="space-y-6">
              <VerificationPanel
                checks={["id_document", "aml", "kyb"]}
                description="Verify your identity (KYC), a sanctions/PEP screen (AML), and your company (KYB). Each result arrives on its own — there is nothing to fill in here."
              />

              <div className="space-y-4 rounded-md border border-border p-5">
                <h2 className="text-sm font-semibold">Notification rules</h2>
                {[
                  { label: "New bid or offer received", desc: "Someone opens a match on a trade you're party to" },
                  { label: "Proof of Intent sealed", desc: "A counterparty seals intent on a shared trade" },
                  { label: "WaD case needs attention", desc: "A compliance check on your trade is waiting" },
                  { label: "Token balance running low", desc: "Fewer than 5 tokens remain" },
                ].map((rule) => (
                  <div key={rule.label} className="flex items-center justify-between gap-4 border-b border-border pb-3 last:border-0 last:pb-0">
                    <div>
                      <p className="text-sm font-medium">{rule.label}</p>
                      <p className="text-xs text-muted-foreground">{rule.desc}</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                ))}
              </div>

              <DangerZone />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="kyb" className="mt-6">
          <OrganisationsPanel />
        </TabsContent>

        <TabsContent value="data" className="mt-6 max-w-lg space-y-6 rounded-md border border-border p-5">
          <div>
            <h2 className="text-sm font-semibold">My data</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Request an export of your account, trade and compliance records. We'll email a
              download link once it's ready.
            </p>
            <a href="mailto:support@izenzo.co.za?subject=Data%20export%20request">
              <Button size="sm" variant="outline" className="mt-4">
                Request data export
              </Button>
            </a>
          </div>

          <div className="border-t border-border pt-6">
            <h2 className="text-sm font-semibold">Data residency</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Regional data residency is configured for a single approved policy.
              Per-organisation residency commitments require separate approval — contact support
              to discuss.
            </p>
          </div>
        </TabsContent>

      </Tabs>
    </AppShell>
  );
}

function DangerZone() {
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="rounded-md border border-destructive/30 bg-destructive/5 p-5">
      <h2 className="text-sm font-semibold text-destructive">Danger zone</h2>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        Delete your account if you no longer need access. Your trade and compliance records are
        retained for the 7-year regulatory window, but your personal details are anonymised
        immediately. You have a 30-day grace period to recover the account by signing back in.
      </p>
      {!confirming ? (
        <Button size="sm" variant="destructive" className="mt-4 gap-2" onClick={() => setConfirming(true)}>
          <Trash2 className="h-3.5 w-3.5" /> Delete my account
        </Button>
      ) : (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-medium text-destructive">
            Account deletion isn't self-service yet — email support and we'll process it within the
            30-day grace window.
          </p>
          <div className="flex gap-2">
            <a href="mailto:support@izenzo.co.za?subject=Account%20deletion%20request">
              <Button size="sm" variant="destructive">
                Email support to delete my account
              </Button>
            </a>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

