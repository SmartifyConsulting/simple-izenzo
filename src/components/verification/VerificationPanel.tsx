import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import QRCode from "qrcode";
import { ChevronDown, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
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
  id_document: "KYC",
  kyb: "KYB",
  aml: "Sanctions / PEP",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "not started",
  in_progress: "in progress",
  passed: "verified",
  review: "needs review",
  failed: "declined",
  expired: "expired",
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

/** Which distinct person/company a row belongs to — a deal's WaD checks always cover two subjects
 * (the bidder's own and the counterparty's own), and mixing them into one row per check type is
 * exactly what made it unclear whose KYC/KYB was whose. */
function subjectKey(r: VerificationRow): string {
  return r.subject_user_id ?? r.subject_org_id ?? r.subject_counterparty_id ?? r.subject_label ?? "unknown";
}

/** Rows are already newest-first from the server — keep only the latest one per distinct subject. */
function latestPerSubject(rows: VerificationRow[]): VerificationRow[] {
  const seen = new Map<string, VerificationRow>();
  for (const r of rows) {
    const k = subjectKey(r);
    if (!seen.has(k)) seen.set(k, r);
  }
  return [...seen.values()];
}

/** A QR code generated client-side from the hosted verification URL — no third-party image service
 * ever sees it, since that URL is a one-time link into this specific person's identity check.
 * Scanning it with a phone is the whole interaction now; nothing here opens a window or a modal. */
function VerificationQr({ value }: { value: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setDataUrl(null);
    void QRCode.toDataURL(value, { width: 160, margin: 1 })
      .then((url) => {
        if (live) setDataUrl(url);
      })
      .catch(() => {
        if (live) setDataUrl(null);
      });
    return () => {
      live = false;
    };
  }, [value]);

  if (!dataUrl) {
    return <div className="h-40 w-40 shrink-0 animate-pulse rounded-lg bg-muted" />;
  }
  return (
    <img
      src={dataUrl}
      alt="Scan with your phone to complete this check"
      width={160}
      height={160}
      className="h-40 w-40 shrink-0 rounded-lg border border-border bg-white p-1.5"
    />
  );
}

type Props = {
  /** Omit for the signed-in person's own verification; supply a deal id for the WaD gate. */
  transactionId?: string;
  checks: CheckType[];
  title?: string;
  description?: string;
  /** Drops the outer bordered card and its header divider — for a caller (the WaD gate) that
   * already renders this inside another frame of its own, so the two borders don't nest. */
  bare?: boolean;
  /** Skips the icon/title/description block entirely — for a caller that renders its own heading
   * and needs to place something (the WaD gate's "Already screened in Step 1") between that
   * heading and the checks themselves, rather than after this component's own closing tag. */
  hideHeader?: boolean;
};

export function VerificationPanel({ transactionId, checks: requested, title, description, bare, hideHeader }: Props) {
  const { user, profile } = useAuth();
  const listEnabled = useServerFn(listEnabledCheckTypes);
  const start = useServerFn(startVerification);
  const refresh = useServerFn(refreshVerification);
  const listMine = useServerFn(listMyVerifications);
  const listForTx = useServerFn(listVerificationsForTx);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Undefined = follow the automatic rule (collapsed once both sides have passed); true/false once
  // a person overrides it by hand, which then wins regardless of status.
  const [openOverride, setOpenOverride] = useState<Record<string, boolean>>({});

  const { data: rows = [], isLoading, refetch } = useQuery({
    queryKey: ["identity-verifications", transactionId ?? "me"],
    queryFn: async (): Promise<VerificationRow[]> =>
      transactionId ? listForTx({ data: { transactionId } }) : listMine({}),
    // Polls while anything is mid-check so a scanned QR's result lands here on its own — no button
    // to remember to click, no window to poll from the other end.
    refetchInterval: (query) => (query.state.data ?? []).some((r) => r.status === "in_progress") ? 4000 : false,
  });

  // The separate sanctions / PEP check only appears while an administrator has it switched on.
  const { data: enabled } = useQuery({
    queryKey: ["enabled-check-types"],
    queryFn: async () => listEnabled({}),
    staleTime: 5 * 60 * 1000,
  });
  const checks = requested.filter((c) => (enabled ?? ["id_document", "kyb"]).includes(c));

  function isMine(r: VerificationRow): boolean {
    if (user?.id && r.subject_user_id === user.id) return true;
    if (profile?.org_id && r.subject_org_id === profile.org_id) return true;
    return false;
  }

  async function onStart(type: CheckType) {
    setBusy(type);
    setError(null);
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : undefined;
      await start({
        data: { checkType: type, ...(transactionId ? { transactionId } : {}), ...(origin ? { origin } : {}) },
      });
      await refetch();
      toast.success("Scan the QR code with your phone to complete this check.");
    } catch (err) {
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

  const Wrapper = bare ? "div" : "section";
  return (
    <Wrapper className={bare ? undefined : "rounded-xl border border-border"}>
      {!hideHeader && (
        <>
          <div className={cn("flex items-center gap-2", bare ? "pb-3" : "border-b border-border px-4 py-3")}>
            <ShieldCheck className="h-4 w-4 text-primary" />
            <h2 className="label-caps font-sans">{title ?? "Identity verification"}</h2>
          </div>

          {description && (
            <p className={cn("text-xs text-muted-foreground", bare ? "pb-3" : "px-4 pt-4")}>{description}</p>
          )}
        </>
      )}

      <div className={cn("space-y-4", bare ? undefined : "p-4")}>
        {isLoading && <p className="text-xs text-muted-foreground">Loading…</p>}

        {checks.map((type) => {
          const subjects = latestPerSubject(rows.filter((r) => r.check_type === type));
          const myRow = subjects.find(isMine) ?? null;
          const otherSubjects = subjects.filter((r) => !isMine(r));

          // Collapses to a one-line summary once both sides have genuinely passed — nothing left
          // to act on, so the full two-column detail is just something to scroll past. A manual
          // override (the chevron below) always wins over this once a person has touched it.
          const bothPassed = Boolean(myRow?.status === "passed") && otherSubjects.length > 0 && otherSubjects.every((r) => r.status === "passed");
          const open = openOverride[type] ?? !bothPassed;

          return (
            <div key={type} className="rounded-lg border border-border p-4">
              <button
                type="button"
                onClick={() => setOpenOverride((prev) => ({ ...prev, [type]: !open }))}
                className="flex w-full items-center justify-between gap-2 text-left"
              >
                <span className="flex items-center gap-2">
                  <span className="label-caps font-sans">{CHECK_LABEL[type]}</span>
                  {bothPassed && (
                    <Badge variant="outline" className="border-emerald-600 bg-emerald-600 font-normal text-white">
                      Both verified
                    </Badge>
                  )}
                </span>
                <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
              </button>

              {/* Two columns, same side each convention appears everywhere else in this app: the
                  other party on the left in blue, "you" on the right in green. Only the right
                  column ever gets a Start/Refresh button or a QR code — nobody can act on someone
                  else's identity check. */}
              {open && (
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2 rounded-lg border border-[#4169e1]/25 bg-[#4169e1]/5 p-3 sm:border-r-2">
                  {otherSubjects.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No check on file yet for the other party.</p>
                  ) : (
                    otherSubjects.map((r) => (
                      <div key={r.id} className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary" className="bg-[#4169e1]/15 font-normal text-[#1c2f6b]">
                            {r.subject_label ?? "Counterparty"}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={cn(STATUS_TONE[r.status] ?? "border-border bg-muted text-muted-foreground")}
                          >
                            {STATUS_LABEL[r.status] ?? r.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{fmt(r.completed_at) ?? fmt(r.created_at) ?? ""}</p>
                      </div>
                    ))
                  )}
                </div>

                <div className="space-y-2 rounded-lg border border-emerald-600/25 bg-emerald-600/5 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="bg-emerald-600/15 font-normal text-emerald-700">
                      You
                    </Badge>
                    <Badge
                      variant="outline"
                      className={cn(STATUS_TONE[myRow?.status ?? "pending"] ?? "border-border bg-muted text-muted-foreground")}
                    >
                      {STATUS_LABEL[myRow?.status ?? "pending"] ?? "not started"}
                    </Badge>
                    {myRow && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2"
                        disabled={busy === myRow.id}
                        onClick={() => onRefresh(myRow.id)}
                        aria-label="Check for a result"
                      >
                        {busy === myRow.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {myRow ? fmt(myRow.completed_at) ?? fmt(myRow.created_at) ?? "" : "No check run yet."}
                  </p>
                  {myRow?.reason && <p className="text-xs text-destructive">{myRow.reason}</p>}

                  {(!myRow || myRow.status === "failed" || myRow.status === "expired") && (
                    <Button size="sm" disabled={busy === type} onClick={() => onStart(type)}>
                      {busy === type ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : myRow ? "Run again" : "Start"}
                    </Button>
                  )}

                  {myRow?.status === "in_progress" && myRow.provider_url && (
                    <div className="flex flex-col items-center space-y-1 pt-1 text-center">
                      <VerificationQr value={myRow.provider_url} />
                      <p className="max-w-[10rem] text-[10px] text-muted-foreground">
                        Scan to continue to the verification app
                      </p>
                    </div>
                  )}
                </div>
              </div>
              )}
            </div>
          );
        })}

        {error && (
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
            {error}
          </p>
        )}

        <p className="text-xs text-muted-foreground">
          A result that is not an outright pass is routed to manual review — it never clears a gate
          on its own.
        </p>
      </div>
    </Wrapper>
  );
}
