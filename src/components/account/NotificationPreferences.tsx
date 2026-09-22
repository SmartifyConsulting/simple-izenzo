import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

export type NotificationChannel = "email" | "in_app" | "both";

type Rule = { key: string; label: string; desc: string };

/** Every notification rule the platform actually raises today — kept in one place so this list
 * and whatever eventually reads it (email senders, the Inbox writer) never drift apart. */
export const NOTIFICATION_RULES: Rule[] = [
  { key: "new_bid", label: "New bid or offer received", desc: "Someone opens a match on a trade you're party to" },
  { key: "poi_sealed", label: "Proof of Intent sealed", desc: "A counterparty seals intent on a shared trade" },
  { key: "wad_attention", label: "WaD case needs attention", desc: "A compliance check on your trade is waiting" },
  { key: "low_tokens", label: "Token balance running low", desc: "Fewer than 5 tokens remain" },
  { key: "counterparty_emailed", label: "Counterparty has been emailed", desc: "Confirms the outreach email actually sent" },
  { key: "counterparty_verified", label: "Counterparty has been verified", desc: "Matched to a registered, known Izenzo account" },
];

const CHANNEL_LABEL: Record<NotificationChannel, string> = {
  email: "Email",
  in_app: "In-app",
  both: "Both",
};

/** Per-rule choice of Email, In-app, or Both — stored on the person's own profile
 * (notification_preferences jsonb), read by whatever sends each notification. A rule missing from
 * the stored object defaults to "both", so nothing silently goes quiet just because this frame
 * hasn't been touched yet. */
export function NotificationPreferences({ profileId }: { profileId: string }) {
  const [prefs, setPrefs] = useState<Record<string, NotificationChannel>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      // notification_preferences predates the generated Supabase types being refreshed — cast
      // through unknown until they're regenerated after this migration runs.
      const { data } = await supabase
        .from("profiles")
        .select("notification_preferences" as "id")
        .eq("id", profileId)
        .maybeSingle();
      if (!live) return;
      const row = data as unknown as { notification_preferences?: Record<string, NotificationChannel> | null } | null;
      setPrefs(row?.notification_preferences ?? {});
      setLoading(false);
    })();
    return () => {
      live = false;
    };
  }, [profileId]);

  async function setChannel(key: string, channel: NotificationChannel) {
    const previous = prefs;
    const next = { ...prefs, [key]: channel };
    setPrefs(next);
    setSavingKey(key);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ notification_preferences: next } as never)
        .eq("id", profileId);
      if (error) throw error;
    } catch (err) {
      toast.error((err as Error).message || "Could not save that preference — please try again.");
      setPrefs(previous);
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="space-y-4 rounded-md border border-border p-5">
      <div>
        <h2 className="text-sm font-semibold">Notification Preferences</h2>
        <p className="text-xs text-muted-foreground">Choose how you want to hear about each of these.</p>
      </div>
      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : (
        NOTIFICATION_RULES.map((rule) => {
          const channel = prefs[rule.key] ?? "both";
          return (
            <div
              key={rule.key}
              className="flex items-center justify-between gap-4 border-b border-border pb-3 last:border-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">{rule.label}</p>
                <p className="text-xs text-muted-foreground">{rule.desc}</p>
              </div>
              <Select
                value={channel}
                onValueChange={(v) => void setChannel(rule.key, v as NotificationChannel)}
                disabled={savingKey === rule.key}
              >
                <SelectTrigger className="h-8 w-[120px] shrink-0 text-xs" aria-label={`${rule.label} channel`}>
                  <SelectValue>{CHANNEL_LABEL[channel]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">Both</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="in_app">In-app</SelectItem>
                </SelectContent>
              </Select>
            </div>
          );
        })
      )}
    </div>
  );
}
