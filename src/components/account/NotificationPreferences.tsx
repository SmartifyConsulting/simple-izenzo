import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export type NotificationChannel = "email" | "in_app" | "both";

const OPTIONS: { value: NotificationChannel; label: string; desc: string }[] = [
  { value: "both", label: "Email and in-app", desc: "Get every notification both ways" },
  { value: "email", label: "Email only", desc: "No in-app notices — just email" },
  { value: "in_app", label: "In-app only", desc: "No email — just your Inbox on Izenzo" },
];

/** One choice for how this person wants to hear about everything the platform notifies them
 * about (a new bid, POI sealed, a WaD case, low tokens, a counterparty being emailed or
 * verified…) — not a separate setting per notification type. Stored on their own profile
 * (notification_channel), read by whatever sends each notification. */
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
    <div className="space-y-3 rounded-md border border-border p-5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Notification Preferences</h2>
          <p className="text-xs text-muted-foreground">How you want to hear about everything on Izenzo.</p>
        </div>
        {saving && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />}
      </div>
      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : (
        <RadioGroup value={channel} onValueChange={(v) => void save(v as NotificationChannel)} className="space-y-2">
          {OPTIONS.map((opt) => (
            <label
              key={opt.value}
              htmlFor={`notif-channel-${opt.value}`}
              className="flex cursor-pointer items-start gap-2.5 rounded-md border border-transparent p-1.5 hover:border-border"
            >
              <RadioGroupItem value={opt.value} id={`notif-channel-${opt.value}`} className="mt-0.5" />
              <span>
                <Label htmlFor={`notif-channel-${opt.value}`} className="cursor-pointer text-sm font-medium">
                  {opt.label}
                </Label>
                <p className="text-xs text-muted-foreground">{opt.desc}</p>
              </span>
            </label>
          ))}
        </RadioGroup>
      )}
    </div>
  );
}
