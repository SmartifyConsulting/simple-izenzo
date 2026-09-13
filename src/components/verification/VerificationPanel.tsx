import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  listEnabledCheckTypes,
  listMyVerifications,
  listVerificationsForTx,
  refreshVerification,
  startVerification,
  type VerificationRow,
} from "@/lib/didit.functions";

export type CheckType = "id_document" | "kyb" | "aml";

const CHECK_LABEL: Record<CheckType, string> = {
  id_document: "ID document + selfie",
  kyb: "Company (KYB) — entity, UBO & AML",
  aml: "Sanctions / PEP",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Not started",
  in_progress: "In progress",
  passed: "Verified",
  review: "Needs review",
  failed: "Declined",
  expired: "Expired",
};

const STATUS_TONE: Record<string, string> = {
  passed: "border-success/40 bg-success/10 text-success",
  review: "border-warning/40 bg-warning/15 text-warning-foreground",
  failed: "border-destructive/40 bg-destructive/10 text-destructive",
  expired: "border-border bg-muted text-muted-foreground",
};

function fmt(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleString();
}

type Props = {
  /** Omit for the signed-in person's own verification; supply a deal id for the WaD gate. */
  transactionId?: string;
  checks: CheckType[];
  title?: string;
  description?: string;
};

export function VerificationPanel({ transactionId, checks: requested, title, description }: Props) {
  const listEnabled = useServerFn(listEnabledCheckTypes);
  const start = useServerFn(startVerification);
  const refresh = useServerFn(refreshVerification);
  const listMine = useServerFn(listMyVerifications);
  const listForTx = useServerFn(listVerificationsForTx);
  const [busy, setBusy] = useState<string | null>(null);
  const [rerunning, setRerunning] = useState(false);

  // The hosted provider page refuses to display inside another site's frame, so we always hand
  // over the link itself as well — if the new tab is blocked, the person can still open it.
  const [sessionUrl, setSessionUrl] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const popupRef = useRef<Window | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: rows = [], isLoading, refetch } = useQuery({
    queryKey: ["identity-verifications", transactionId ?? "me"],
    queryFn: async (): Promise<VerificationRow[]> =>
      transactionId ? listForTx({ data: { transactionId } }) : listMine({}),
  });

  const latest = (type: CheckType) => rows.find((r) => r.check_type === type);

  function isNarrow() {
    return typeof window !== "undefined" && window.matchMedia("(max-width: 640px)").matches;
  }

  /** Open the provider in its own window, launched inside the click so no popup blocker fires:
   * the window is opened blank first, then pointed at the session URL once it comes back. The
   * provider refuses to be displayed inside another site, so an in-page frame is impossible. */
  function openProviderWindow(url: string) {
    if (isNarrow()) {
      const tab = window.open(url, "_blank", "noopener,noreferrer");
      setBlocked(!tab);
      return;
    }
    const existing = popupRef.current;
    if (existing && !existing.closed) {
      existing.location.href = url;
      existing.focus();
      setBlocked(false);
      return;
    }
    const win = window.open(url, "izenzo-verify", "popup,width=520,height=800");
    popupRef.current = win;
    setBlocked(!win);
    if (win) win.focus();
  }

  async function onStart(type: CheckType) {
    setBusy(type);
    setError(null);
    // Opened synchronously with the click; only the destination waits on the server.
    const pending = isNarrow()
      ? null
      : window.open("", "izenzo-verify", "popup,width=520,height=800");
    if (pending) {
      popupRef.current = pending;
      try {
        pending.document.write(
          "<title>Opening verification…</title><body style='font:14px system-ui;padding:24px'>Opening your identity check…</body>",
        );
      } catch {
        // Some browsers disallow writing into the blank popup — harmless.
      }
    }
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : undefined;
      const res = await start({
        data: { checkType: type, ...(transactionId ? { transactionId } : {}), ...(origin ? { origin } : {}) },
      });
      setSessionUrl(res.url);
      openProviderWindow(res.url);
      toast.success("Verification opened in its own window. The result lands here on its own.");
      void refetch();
    } catch (err) {
      pending?.close();
      popupRef.current = null;
      setError((err as Error).message);
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function onRefresh(id: string) {
    setBusy(id);
    try {
      await refresh({ data: { id } });
      void refetch();
    } catch (err) {
      setError((err as Error).message);
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied — paste it into a new browser tab.");
    } catch {
      toast.error("Could not copy the link. Select it and copy it by hand.");
    }
  }

  async function onRerunAll() {
    setRerunning(true);
    setError(null);
    let opened = 0;
    for (const type of checks) {
      try {
        const origin = typeof window !== "undefined" ? window.location.origin : undefined;
        const res = await start({
          data: { checkType: type, ...(transactionId ? { transactionId } : {}), ...(origin ? { origin } : {}) },
        });
        if (res.url) setSessionUrl(res.url);
        opened += 1;
      } catch (err) {
        setError((err as Error).message);
      }
    }
    setRerunning(false);
    void refetch();
    if (opened > 0) {
      toast.success(`${opened} of ${checks.length} checks re-opened.`);
    } else {
      toast.error("None of the checks could be re-opened.");
    }
  }

  return (
    <section className="rounded-xl border border-border">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h2 className="label-caps font-sans">{title ?? "Identity verification"}</h2>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1.5 text-xs"
          disabled={rerunning || Boolean(busy)}
          onClick={() => void onRerunAll()}
        >
          {rerunning ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Re-run all
        </Button>
      </div>

      {description && (
        <p className="px-4 pt-4 text-xs text-muted-foreground">{description}</p>
      )}

      <div className="space-y-3 p-4">
        {isLoading && <p className="text-xs text-muted-foreground">Loading…</p>}


        {checks.map((type) => {
          const row = latest(type);
          const status = row?.status ?? "pending";
          return (
            <div
              key={type}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4"
            >
              <div className="min-w-0">
                <p className="text-xs font-medium">{CHECK_LABEL[type]}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {row
                    ? `${row.subject_label ? `${row.subject_label} · ` : ""}${
                        fmt(row.completed_at) ?? fmt(row.created_at) ?? ""
                      }`
                    : "No check run yet."}
                </p>
                {row?.reason && <p className="mt-1 text-xs text-destructive">{row.reason}</p>}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn(STATUS_TONE[status] ?? "border-border bg-muted text-muted-foreground")}
                >
                  {STATUS_LABEL[status] ?? status}
                </Badge>

                {row && row.status === "in_progress" && row.provider_url && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSessionUrl(row.provider_url);
                      openProviderWindow(row.provider_url!);
                    }}
                  >
                    {popupRef.current && !popupRef.current.closed ? "Reopen window" : "Continue"}
                  </Button>
                )}

                {row && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy === row.id}
                    onClick={() => onRefresh(row.id)}
                    aria-label="Check for a result"
                  >
                    {busy === row.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                  </Button>
                )}

                <Button size="sm" disabled={busy === type} onClick={() => onStart(type)}>
                  {busy === type ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : row ? "Run again" : "Start"}
                </Button>
              </div>
            </div>
          );
        })}

        {error && (
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
            {error}
          </p>
        )}

        {sessionUrl && (
          <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">
              {blocked
                ? "Your browser blocked the verification window. It cannot be shown inside this page, so open it yourself:"
                : "Verification in progress in its own window. Lost it? Reopen it here — it cannot be shown inside this page."}
            </p>
            <p className="break-all text-[11px] text-muted-foreground">{sessionUrl}</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => openProviderWindow(sessionUrl)}>
                Reopen window
              </Button>
              <a href={sessionUrl} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline">
                  Open in a new tab
                </Button>
              </a>
              <Button size="sm" variant="ghost" onClick={() => void copyLink(sessionUrl)}>
                Copy link
              </Button>
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          A result that is not an outright pass is routed to manual review — it never clears a gate
          on its own.
        </p>
      </div>
    </section>
  );
}
