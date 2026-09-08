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
import {
  INTEGRATION_GROUPS,
  INTEGRATION_PROVIDERS,
  type IntegrationProvider,
} from "@/lib/integrations.catalog";
import {
  deleteIntegration,
  listIntegrations,
  revealIntegrationSecrets,
  saveIntegration,
  testIntegration,
  type IntegrationRow,
} from "@/lib/integrations.functions";

/** Most useful first — the order the guided setup walks through. */
const GUIDED_ORDER = [
  "resend",
  "payfast",
  "smile_identity",
  "cipc",
  "complyadvantage",
  "exchangerate_host",
];

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

  const byProvider = useMemo(
    () => Object.fromEntries(rows.map((r) => [r.provider, r])) as Record<string, IntegrationRow>,
    [rows],
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
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {guided ? (
        <GuidedSetup byProvider={byProvider} onChanged={refresh} />
      ) : (
        INTEGRATION_GROUPS.map((group) => {
          const providers = INTEGRATION_PROVIDERS.filter((p) => p.group === group);
          if (providers.length === 0) return null;
          return (
            <section key={group} className="space-y-3">
              <h3 className="text-sm font-semibold">{group}</h3>
              <div className="grid gap-4 xl:grid-cols-2">
                {providers.map((p) => (
                  <ProviderCard key={p.id} provider={p} row={byProvider[p.id]} onChanged={refresh} />
                ))}
              </div>
            </section>
          );
        })
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

  const configured = Boolean(row);

  async function onSave() {
    setBusy("save");
    try {
      await save({ data: { provider: provider.id, environment, enabled, config, secrets } });
      setSecrets({});
      onChanged();
      toast.success(`${provider.name} credentials saved`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function onReveal() {
    setBusy("reveal");
    try {
      const plain = await reveal({ data: { provider: provider.id } });
      setSecrets(plain);
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
    <div className="rounded-md border border-border p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Plug className="h-4 w-4 text-muted-foreground" />
            <h4 className="text-sm font-semibold">{provider.name}</h4>
            {configured ? (
              <Badge variant="secondary">Saved</Badge>
            ) : (
              <Badge variant="outline">Not set up</Badge>
            )}
          </div>
          <p className="mt-1 max-w-prose text-xs text-muted-foreground">{provider.summary}</p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor={`${provider.id}-enabled`} className="text-xs text-muted-foreground">
            Live
          </Label>
          <Switch id={`${provider.id}-enabled`} checked={enabled} onCheckedChange={setEnabled} />
        </div>
      </div>

      <div className="mt-4 space-y-3">
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

        {provider.fields.map((field) => (
          <div key={field.key} className="space-y-1.5">
            <Label htmlFor={`${provider.id}-${field.key}`}>{field.label}</Label>
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
        ))}
      </div>

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

      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" onClick={onSave} disabled={busy !== null}>
          {busy === "save" && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          Save
        </Button>
        {configured && (
          <Button size="sm" variant="outline" onClick={onReveal} disabled={busy !== null}>
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
        {configured && (
          <Button size="sm" variant="ghost" onClick={onRemove} disabled={busy !== null}>
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}
