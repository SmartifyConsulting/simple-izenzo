import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export type NotificationChannel = "email" | "in_app" | "both";

const CHANNEL_LABEL: Record<NotificationChannel, string> = {
  both: "Email and in-app",
  email: "Email only",
  in_app: "In-app only",
};

/** What a person is actually subscribed to — informational, not individually switchable; the one
 * choice that matters is how (below), not which. */
const SUBSCRIBED_TO = [
  "New bid or offer received",
  "Proof of Intent sealed",
  "WaD case needs attention",
  "Token balance running low",
  "Counterparty has been emailed",
  "Counterparty has been verified",
];

/** One row, one choice — how this person wants to hear about everything the platform notifies
 * them about. Stored on their own profile (notification_channel), read by whatever sends each
 * notification. */
export function NotificationPreferences({ profileId }: { profileId: string }) {
  const [channel, setChannel] = useState<NotificationChannel>("both");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      // notification_channel predates the generated Supabase types being refreshed — cast
      // through unknown until they're regenerated after this migration runs.
      const { data } = await supabase
        .from("profiles")
        .select("notification_channel" as "id")
        .eq("id", profileId)
        .maybeSingle();
      if (!live) return;
      const row = data as unknown as { notification_channel?: NotificationChannel | null } | null;
      setChannel(row?.notification_channel ?? "both");
      setLoading(false);
    })();
    return () => {
      live = false;
    };
  }, [profileId]);

  async function save(next: NotificationChannel) {
    const previous = channel;
    setChannel(next);
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ notification_channel: next } as never)
        .eq("id", profileId);
      if (error) throw error;
    } catch (err) {
      toast.error((err as Error).message || "Could not save that preference — please try again.");
      setChannel(previous);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 rounded-md border border-border p-5">
      <div>
        <h2 className="text-sm font-semibold">Notification Preferences</h2>
        <p className="mt-1 text-xs text-muted-foreground">You're subscribed to:</p>
        <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
          {SUBSCRIBED_TO.map((label) => (
            <li key={label}>{label}</li>
          ))}
        </ul>
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
        <Label htmlFor="notification-channel" className="text-sm font-medium">
          Notify me via
        </Label>
        <div className="flex items-center gap-2">
          {saving && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />}
          <Select value={channel} onValueChange={(v) => void save(v as NotificationChannel)} disabled={loading}>
            <SelectTrigger id="notification-channel" className="h-8 w-[170px] text-xs">
              <SelectValue>{CHANNEL_LABEL[channel]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="both">Email and in-app</SelectItem>
              <SelectItem value="email">Email only</SelectItem>
              <SelectItem value="in_app">In-app only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
