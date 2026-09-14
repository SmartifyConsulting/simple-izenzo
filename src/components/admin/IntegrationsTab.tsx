import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Eye, Lock, Loader2, Plug, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { PasswordInput } from "@/components/PasswordInput";
import { INTEGRATION_PROVIDERS, type IntegrationProvider } from "@/lib/integrations.catalog";
import {
  deleteIntegration,
  listIntegrations,
  revealIntegrationSecrets,
  saveIntegration,
  testIntegration,
  type IntegrationRow,
} from "@/lib/integrations.functions";

/** Most useful first — the order the guided setup walks through. */
const GUIDED_ORDER = ["resend", "payfast", "cipc"];

function guidedProviders(): IntegrationProvider[] {
  const ranked = GUIDED_ORDER.map((id) => INTEGRATION_PROVIDERS.find((p) => p.id === id)).filter(
    Boolean,
  ) as IntegrationProvider[];
  const rest = INTEGRATION_PROVIDERS.filter((p) => !GUIDED_ORDER.includes(p.id));
  return [...ranked, ...rest];
}

export function IntegrationsTab() {
  const qc = useQueryClient();
  const load = useServerFn(listIntegrations);
  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ["integrations"],
    queryFn: () => load({ data: undefined as never }),
    retry: false,
  });

  const [guided, setGuided] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const byProvider = useMemo(
    () => Object.fromEntries(rows.map((r) => [r.provider, r])) as Record<string, IntegrationRow>,
    [rows],
  );
  const isArchived = (id: string) => (byProvider[id]?.config as Record<string, string> | undefined)?.["archived"] === "true";
  const archivedCount = INTEGRATION_PROVIDERS.filter((p) => isArchived(p.id)).length;
  const activeProviders = INTEGRATION_PROVIDERS.filter(
    (p) => byProvider[p.id]?.enabled && (showArchived || !isArchived(p.id)),
  );
  const inactiveProviders = INTEGRATION_PROVIDERS.filter(
    (p) => !byProvider[p.id]?.enabled && (showArchived || !isArchived(p.id)),
  );

  const refresh = () => qc.invalidateQueries({ queryKey: ["integrations"] });

  if (error) {
    const forbidden = error.message.includes("restricted to administrators");
    return (
      <p className="text-sm text-muted-foreground">
        {forbidden ? "This area is restricted to the system administrator." : error.message}
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start gap-3 rounded-md border border-border bg-muted/40 p-4">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          Every password, key and token on this page is encrypted before it is stored and is never
          sent back to the browser unless you press <strong>Reveal</strong>. Only the system
          administrator can open this page. Leave a secret field blank to keep the value already saved.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant={guided ? "outline" : "default"} onClick={() => setGuided(false)}>
          All services
        </Button>
        <Button size="sm" variant={guided ? "default" : "outline"} onClick={() => setGuided(true)}>
          Guided setup
        </Button>
        <span className="text-xs text-muted-foreground">
          Guided setup takes you through the services one at a time, in the order that matters most.
        </span>
        {!guided && archivedCount > 0 && (
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto text-muted-foreground"
            onClick={() => setShowArchived((v) => !v)}
          >
            {showArchived ? "Hide" : "Show"} archived ({archivedCount})
          </Button>
        )}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {guided ? (
        <GuidedSetup byProvider={byProvider} onChanged={refresh} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              Active
              <Badge variant="outline" className="font-normal text-muted-foreground">
                {activeProviders.length}
              </Badge>
            </h3>
            {activeProviders.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nothing turned on yet.</p>
            ) : (
              <div className="space-y-2">
                {activeProviders.map((p) => (
                  <ProviderCard key={p.id} provider={p} row={byProvider[p.id]} onChanged={refresh} />
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              Inactive
              <Badge variant="outline" className="font-normal text-muted-foreground">
                {inactiveProviders.length}
              </Badge>
            </h3>
            <div className="space-y-2">
              {inactiveProviders.map((p) => (
                <ProviderCard key={p.id} provider={p} row={byProvider[p.id]} onChanged={refresh} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GuidedSetup({
  byProvider,
  onChanged,
}: {
  byProvider: Record<string, IntegrationRow>;
  onChanged: () => void;
}) {
  const steps = useMemo(guidedProviders, []);
  const [index, setIndex] = useState(0);
  const [skipped, setSkipped] = useState<Record<string, boolean>>({});

  const provider = steps[index]!;
  const done = (id: string) => Boolean(byProvider[id]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {steps.map((p, i) => {
          const state = done(p.id) ? "done" : skipped[p.id] ? "skipped" : "todo";
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setIndex(i)}
              className={`rounded-full border px-3 py-1 text-xs ${
                i === index
                  ? "border-primary bg-primary text-primary-foreground"
                  : state === "done"
                    ? "border-emerald-600/40 bg-emerald-600/10 text-foreground"
                    : state === "skipped"
                      ? "border-border text-muted-foreground line-through"
                      : "border-border text-muted-foreground"
              }`}
            >
              {p.name}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Step {index + 1} of {steps.length} · {steps.filter((p) => done(p.id)).length} set up
      </p>

      <div className="rounded-md border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">What you need for {provider.name}</p>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          {provider.fields.map((f) => (
            <li key={f.key}>
              <span className="text-foreground">{f.label}</span>
              {f.help ? ` — ${f.help}` : ""}
            </li>
          ))}
        </ul>
        {provider.docsUrl && (
          <a
            href={provider.docsUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-2 inline-block underline"
          >
            Where to find these in the {provider.name} portal
          </a>
        )}
      </div>

      <ProviderCard
        key={provider.id}
        provider={provider}
        row={byProvider[provider.id]}
        onChanged={onChanged}
      />

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>
          Back
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setSkipped((s) => ({ ...s, [provider.id]: true }));
            setIndex((i) => Math.min(i + 1, steps.length - 1));
          }}
        >
          Skip for now
        </Button>
        <Button
          size="sm"
          disabled={index === steps.length - 1}
          onClick={() => setIndex((i) => Math.min(i + 1, steps.length - 1))}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

function ProviderCard({
  provider,
  row,
  onChanged,
}: {
  provider: IntegrationProvider;
  row: IntegrationRow | undefined;
  onChanged: () => void;
}) {
  const save = useServerFn(saveIntegration);
  const reveal = useServerFn(revealIntegrationSecrets);
  const test = useServerFn(testIntegration);
  const remove = useServerFn(deleteIntegration);

  const [config, setConfig] = useState<Record<string, string>>(row?.config ?? {});
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [environment, setEnvironment] = useState(row?.environment ?? provider.environments?.[0] ?? "production");
  const [enabled, setEnabled] = useState(row?.enabled ?? false);
  const [busy, setBusy] = useState<null | "save" | "test" | "reveal">(null);
  const [expanded, setExpanded] = useState(false);
  const [vaultPrompt, setVaultPrompt] = useState(false);
  const [vaultPassword, setVaultPassword] = useState("");

  const configured = Boolean(row);
  const archived = config["archived"] === "true";
  const savedFieldCount = provider.fields.filter((f) =>
    f.secret ? Boolean(row?.maskedSecrets[f.key]) : Boolean((config[f.key] ?? "").trim()),
  ).length;

  async function onSave() {
    setBusy("save");
    try {
      await save({ data: { provider: provider.id, environment, enabled, config, secrets } });
      setSecrets({});
      onChanged();
      toast.success(`${provider.name} credentials saved`);
      setExpanded(false);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  /** Archived services aren't currently in use, but keep whatever credentials are already saved —
   * this just hides them from the main list so it isn't cluttered with services nobody's using. */
  async function onToggleArchive() {
    const nextConfig = { ...config, archived: archived ? "false" : "true" };
    setBusy("save");
    try {
      await save({ data: { provider: provider.id, environment, enabled, config: nextConfig, secrets: {} } });
      setConfig(nextConfig);
      onChanged();
      toast.success(archived ? `${provider.name} restored` : `${provider.name} archived`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function onReveal() {
    if (!vaultPassword) return;
    setBusy("reveal");
    try {
      const plain = await reveal({ data: { provider: provider.id, vaultPassword } });
      setSecrets(plain);
      setVaultPrompt(false);
      setVaultPassword("");
      toast.success("Stored values loaded — use the eye icon to show them.");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function onTest() {
    setBusy("test");
    try {
      const result = await test({ data: { provider: provider.id } });
      onChanged();
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function onRemove() {
    setBusy("save");
    try {
      await remove({ data: { provider: provider.id } });
      setSecrets({});
      setConfig({});
      setEnabled(false);
      onChanged();
      toast.success(`${provider.name} credentials removed`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-md border border-border p-3">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Plug className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <h4 className="text-xs font-semibold">{provider.name}</h4>
            {configured ? (
              <Badge variant="secondary" className="text-[10px]">Saved</Badge>
            ) : (
              <Badge variant="outline" className="text-[10px]">Not set up</Badge>
            )}
            {configured && !enabled && (
              <Badge variant="outline" className="text-[10px] text-amber-600">Not connected</Badge>
            )}
            {archived && (
              <Badge variant="outline" className="text-[10px] text-muted-foreground">Archived</Badge>
            )}
            <span className="text-[10px] text-muted-foreground">
              {savedFieldCount}/{provider.fields.length} settings saved
            </span>
          </div>
          {!expanded && <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{provider.summary}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <Switch id={`${provider.id}-enabled`} checked={enabled} onCheckedChange={setEnabled} />
        </div>
      </button>

      {expanded && (
      <div className="mt-3 space-y-3">
        <p className="text-xs text-muted-foreground">{provider.summary}</p>
        <p className="text-[11px] text-muted-foreground">
          <span className="font-semibold text-foreground">Used at:</span> {provider.usedAt}
        </p>
        {provider.costNote && (
          <p className="text-[11px] text-muted-foreground">
            <span className="font-semibold text-foreground">Cost:</span> {provider.costNote}
          </p>
        )}
        {provider.environments && provider.environments.length > 1 && (
          <div className="space-y-1.5">
            <Label htmlFor={`${provider.id}-env`}>Environment</Label>
            <select
              id={`${provider.id}-env`}
              value={environment}
              onChange={(e) => setEnvironment(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {provider.environments.map((env) => (
                <option key={env} value={env}>
                  {env}
                </option>
              ))}
            </select>
          </div>
        )}

        {provider.fields.map((field) => {
          const saved = field.secret
            ? Boolean(row?.maskedSecrets[field.key])
            : Boolean((config[field.key] ?? "").trim());
          const pending = field.secret && Boolean((secrets[field.key] ?? "").trim());
          if (field.type === "switch") {
            return (
              <div key={field.key} className="space-y-1.5 rounded-md border border-border p-2.5">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor={`${provider.id}-${field.key}`}>{field.label}</Label>
                  <Switch
                    id={`${provider.id}-${field.key}`}
                    checked={config[field.key] === "true"}
                    onCheckedChange={(v) =>
                      setConfig((c) => ({ ...c, [field.key]: v ? "true" : "false" }))
                    }
                  />
                </div>
                {field.help && <p className="text-xs text-muted-foreground">{field.help}</p>}
              </div>
            );
          }
          return (
          <div key={field.key} className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor={`${provider.id}-${field.key}`}>{field.label}</Label>
              <span
                className={
                  saved || pending
                    ? "text-[10px] font-medium text-emerald-600"
                    : "text-[10px] text-muted-foreground"
                }
              >
                {pending ? "Unsaved change" : saved ? "Saved" : "Not set"}
              </span>
            </div>
            {field.secret ? (
              <PasswordInput
                id={`${provider.id}-${field.key}`}
                value={secrets[field.key] ?? ""}
                placeholder={row?.maskedSecrets[field.key] ?? field.placeholder ?? "Enter to set"}
                autoComplete="new-password"
                onChange={(e) => setSecrets((s) => ({ ...s, [field.key]: e.target.value }))}
              />
            ) : (
              <Input
                id={`${provider.id}-${field.key}`}
                value={config[field.key] ?? ""}
                placeholder={field.placeholder ?? ""}
                onChange={(e) => setConfig((c) => ({ ...c, [field.key]: e.target.value }))}
              />
            )}
            {field.help && <p className="text-xs text-muted-foreground">{field.help}</p>}
          </div>
          );
        })}

      {row?.lastTestedAt && (
        <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
          {row.lastTestOk ? (
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-emerald-600" />
          ) : (
            <XCircle className="mt-0.5 h-3.5 w-3.5 text-destructive" />
          )}
          <span>
            Last checked {new Date(row.lastTestedAt).toLocaleString()} — {row.lastTestMessage}
          </span>
        </p>
      )}
      {!provider.testable && provider.testNote && (
        <p className="mt-3 text-xs text-muted-foreground">{provider.testNote}</p>
      )}

      {vaultPrompt && (
        <div className="flex items-end gap-2 rounded-md border border-primary/30 bg-primary/5 p-2.5">
          <div className="flex-1 space-y-1">
            <Label htmlFor={`${provider.id}-vault`} className="text-xs">
              Vault password
            </Label>
            <PasswordInput
              id={`${provider.id}-vault`}
              value={vaultPassword}
              autoComplete="off"
              onChange={(e) => setVaultPassword(e.target.value)}
            />
          </div>
          <Button size="sm" onClick={onReveal} disabled={busy !== null || !vaultPassword}>
            {busy === "reveal" && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Confirm
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setVaultPrompt(false); setVaultPassword(""); }}>
            Cancel
          </Button>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" onClick={onSave} disabled={busy !== null}>
          {busy === "save" && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          Save
        </Button>
        {configured && !vaultPrompt && (
          <Button size="sm" variant="outline" onClick={() => setVaultPrompt(true)} disabled={busy !== null}>
            <Eye className="mr-1.5 h-3.5 w-3.5" />
            Reveal
          </Button>
        )}
        {configured && provider.testable && (
          <Button size="sm" variant="outline" onClick={onTest} disabled={busy !== null}>
            {busy === "test" && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Test connection
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={onToggleArchive} disabled={busy !== null}>
          {archived ? "Restore" : "Archive"}
        </Button>
        {configured && (
          <Button size="sm" variant="ghost" onClick={onRemove} disabled={busy !== null}>
            Remove
          </Button>
        )}
      </div>
      </div>
      )}
    </div>
  );
}
