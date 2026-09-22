import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";

export type NotificationChannel = "email" | "in_app" | "both";

const CHANNEL_LABEL: Record<NotificationChannel, string> = {
  both: "Email and in-app",
  email: "Email only",
  in_app: "In-app only",
};

export type NotificationTypeKey =
  | "new_bid_or_offer"
  | "poi_sealed"
  | "wad_attention"
  | "low_token_balance"
  | "counterparty_emailed"
  | "counterparty_verified";

/** Each item a person can opt out of individually. A missing key in the saved map means
 * "subscribed" — every box starts ticked. */
const SUBSCRIBED_TO: { key: NotificationTypeKey; label: string }[] = [
  { key: "new_bid_or_offer", label: "New bid or offer received" },
  { key: "poi_sealed", label: "Proof of Intent sealed" },
  { key: "wad_attention", label: "WaD case needs attention" },
  { key: "low_token_balance", label: "Token balance running low" },
  { key: "counterparty_emailed", label: "Counterparty has been emailed" },
  { key: "counterparty_verified", label: "Counterparty has been verified" },
];

type SubscriptionMap = Partial<Record<NotificationTypeKey, boolean>>;

/** Which notification types this person is opted into (checkboxes), and how they want to hear
 * about them (the dropdown below). Stored on their own profile — notification_subscriptions and
 * notification_channel — read by whatever sends each notification. */
export function NotificationPreferences({ profileId }: { profileId: string }) {
  const [channel, setChannel] = useState<NotificationChannel>("both");
  const [subscriptions, setSubscriptions] = useState<SubscriptionMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingKey, setSavingKey] = useState<NotificationTypeKey | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      // Both columns predate the generated Supabase types being refreshed — cast through unknown
      // until they're regenerated after this migration runs.
      const { data } = await supabase
        .from("profiles")
        .select("notification_channel, notification_subscriptions" as "id")
        .eq("id", profileId)
        .maybeSingle();
      if (!live) return;
      const row = data as unknown as {
        notification_channel?: NotificationChannel | null;
        notification_subscriptions?: SubscriptionMap | null;
      } | null;
      setChannel(row?.notification_channel ?? "both");
      setSubscriptions(row?.notification_subscriptions ?? {});
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

  async function toggle(key: NotificationTypeKey, checked: boolean) {
    const previous = subscriptions;
    const next = { ...subscriptions, [key]: checked };
    setSubscriptions(next);
    setSavingKey(key);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ notification_subscriptions: next } as never)
        .eq("id", profileId);
      if (error) throw error;
    } catch (err) {
      toast.error((err as Error).message || "Could not save that preference — please try again.");
      setSubscriptions(previous);
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="space-y-4 rounded-md border border-border p-5">
      <div>
        <h2 className="text-sm font-semibold">Notification Preferences</h2>
        <p className="mt-1 text-xs text-muted-foreground">Tick what you want to hear about:</p>
        <ul className="mt-2 space-y-1.5">
          {SUBSCRIBED_TO.map(({ key, label }) => (
            <li key={key} className="flex items-center gap-2">
              <Checkbox
                id={`sub-${key}`}
                checked={subscriptions[key] ?? true}
                disabled={loading || savingKey === key}
                onCheckedChange={(v) => void toggle(key, v === true)}
              />
              <Label htmlFor={`sub-${key}`} className="text-xs font-normal text-muted-foreground">
                {label}
              </Label>
              {savingKey === key && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            </li>
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
