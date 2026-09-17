import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const API_SCOPES = [
  "api:status_read",
  "counterparty:lookup",
  "counterparty:summary_read",
  "usage:read",
  "webhook:test",
  "webhook:events_read",
] as const;

export const GATEWAY_URL = "https://<project-ref>.functions.supabase.co/api-gateway";

export function ApiKeysTab() {
  const qc = useQueryClient();
  const { org } = useAuth();
  const [form, setForm] = useState({
    environment: "sandbox",
    name: "",
    scopes: [...API_SCOPES] as string[],
    commercialOwner: "",
    complianceOwner: "",
  });
  const [issuedKey, setIssuedKey] = useState<string | null>(null);

  const { data: keys = [] } = useQuery({
    queryKey: ["org-api-keys", org?.id],
    enabled: Boolean(org?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("api_keys")
        .select("*")
        .eq("org_id", org!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["org-api-keys", org?.id] });
  }

  async function createKey(e: React.FormEvent) {
    e.preventDefault();
    if (!org?.id || !form.name.trim()) {
      toast.error("Key name is required.");
      return;
    }
    const { data, error } = await supabase.rpc("admin_api_create_key", {
      p_org_id: org.id,
      p_environment: form.environment as "sandbox" | "production",
      p_name: form.name,
      p_scopes: form.scopes,
      ...(form.commercialOwner ? { p_commercial_owner: form.commercialOwner } : {}),
      ...(form.complianceOwner ? { p_compliance_owner: form.complianceOwner } : {}),
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    setIssuedKey(row?.raw_key ?? null);
    toast.success("Key created — copy it now, it will not be shown again");
    setForm({ environment: "sandbox", name: "", scopes: [...API_SCOPES], commercialOwner: "", complianceOwner: "" });
    await refresh();
  }

  async function suspend(id: string) {
    const { error } = await supabase.rpc("admin_api_suspend_key", { p_id: id });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Key suspended");
    await refresh();
  }

  async function reactivate(id: string) {
    const { error } = await supabase.rpc("admin_api_reactivate_key", { p_id: id });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Key reactivated");
    await refresh();
  }

  async function revoke(id: string) {
    const reason = window.prompt("Revocation reason (required):");
    if (!reason) return;
    const { error } = await supabase.rpc("admin_api_revoke_key", { p_id: id, p_reason: reason });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Key revoked");
    await refresh();
  }

  async function rotate(id: string) {
    const { data, error } = await supabase.rpc("admin_api_rotate_key", { p_id: id });
    if (error) {
      toast.error(error.message);
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    setIssuedKey(row?.raw_key ?? null);
    toast.success("Key rotated — copy the new key now, it will not be shown again");
    await refresh();
  }

  return (
    <div className="space-y-8">
      <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
        Keys are issued for your organisation, {org?.name ?? "—"}. A production key requires a
        named commercial owner and compliance owner. Sandbox keys expire in 90 days, production in
        12 months — there are no perpetual keys. Gateway base:{" "}
        <code className="rounded bg-black/10 px-1">{GATEWAY_URL}/&lt;sandbox|production&gt;/v1/...</code>
      </div>

      {issuedKey && (
        <div className="rounded-md border border-info/40 bg-info/10 p-3 text-sm">
          <p className="font-medium">Copy this key now — it will not be shown again:</p>
          <code className="mt-1 block break-all rounded bg-black/10 p-2 text-xs">{issuedKey}</code>
          <Button size="sm" variant="ghost" className="mt-2" onClick={() => setIssuedKey(null)}>
            Dismiss
          </Button>
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold">Issue a new key</h2>
        <form onSubmit={createKey} className="mt-2 space-y-3 rounded-md border border-border p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Environment</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={form.environment}
                onChange={(e) => setForm({ ...form, environment: e.target.value })}
              >
                <option value="sandbox">Sandbox</option>
                <option value="production">Production</option>
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Key name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
          </div>

          <div>
            <Label>Scopes</Label>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {API_SCOPES.map((s) => (
                <label key={s} className="flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={form.scopes.includes(s)}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        scopes: e.target.checked ? [...form.scopes, s] : form.scopes.filter((x) => x !== s),
                      })
                    }
                  />
                  {s}
                </label>
              ))}
            </div>
          </div>

          {form.environment === "production" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Commercial owner (required for production)</Label>
                <Input
                  value={form.commercialOwner}
                  onChange={(e) => setForm({ ...form, commercialOwner: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Compliance owner (required for production)</Label>
                <Input
                  value={form.complianceOwner}
                  onChange={(e) => setForm({ ...form, complianceOwner: e.target.value })}
                />
              </div>
            </div>
          )}

          <div className="text-right">
            <Button type="submit" size="sm">
              Create key
            </Button>
          </div>
        </form>
      </div>

      <div>
        <h2 className="text-sm font-semibold">Keys</h2>
        {keys.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No keys yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {keys.map((k) => {
              return (
                <li key={k.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3 text-xs">
                  <span>
                    <span className="font-medium">{k.name}</span> ·{" "}
                    <code className="rounded bg-muted px-1">{k.key_prefix}…</code> · {k.environment} · expires{" "}
                    {new Date(k.expires_at).toLocaleDateString()}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Badge variant={k.status === "active" ? "outline" : "secondary"} className="font-normal">
                      {k.status}
                    </Badge>
                    {k.status === "active" && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => suspend(k.id)}>
                          Suspend
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => rotate(k.id)}>
                          Rotate
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => revoke(k.id)}>
                          Revoke
                        </Button>
                      </>
                    )}
                    {k.status === "suspended" && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => reactivate(k.id)}>
                          Reactivate
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => revoke(k.id)}>
                          Revoke
                        </Button>
                      </>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
