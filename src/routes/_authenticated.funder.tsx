import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { downloadEvidencePack } from "@/lib/evidencePack.functions";

export const Route = createFileRoute("/_authenticated/funder")({
  head: () => ({
    meta: [
      { title: "Funder Workspace — Izenzo" },
      { name: "description", content: "View released counterparty information and record funding decisions." },
    ],
  }),
  component: FunderWorkspace,
});

const FIELD_LABEL: Record<string, string> = {
  legal_name: "Legal name",
  trading_name: "Trading name",
  registration_number: "Registration number",
  country_of_incorporation: "Country of incorporation",
  role_in_transaction: "Role in transaction",
  verified_status: "Verified status",
  business_contact: "Business contact details",
};

const DECISION_LABEL: Record<string, string> = {
  recommend_fund: "Recommend funding",
  decline: "Decline",
  request_more_info: "Request more information",
};

function FunderWorkspace() {
  const { roles, signOut } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isFunder = roles.includes("funder") || roles.includes("admin");
  const download = useServerFn(downloadEvidencePack);

  const { data: releases = [], isLoading } = useQuery({
    queryKey: ["funder-releases"],
    enabled: isFunder,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("funder_releases")
        .select("*, counterparties(name), funder_decisions(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: packs = [] } = useQuery({
    queryKey: ["funder-evidence-packs"],
    enabled: isFunder,
    queryFn: async () => {
      const { data, error } = await supabase.from("evidence_packs").select("*").is("revoked_at", null);
      if (error) throw error;
      return data ?? [];
    },
  });

  async function handleDownload(packId: string) {
    try {
      const { url } = await download({ data: { packId } });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function recordView(id: string) {
    const { error } = await supabase.rpc("funder_record_view", { p_release_id: id });
    if (error) {
      toast.error(error.message);
      return;
    }
  }

  async function recordDecision(id: string, decision: string) {
    const note = window.prompt("Note (optional):");
    const { error } = await supabase.rpc("funder_record_decision", {
      p_release_id: id,
      p_decision: decision as "recommend_fund" | "decline" | "request_more_info",
      ...(note ? { p_note: note } : {}),
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Decision recorded");
    await qc.invalidateQueries({ queryKey: ["funder-releases"] });
  }

  if (!isFunder) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <p className="text-sm text-muted-foreground">This area is for funder seats only.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <Logo className="h-6 w-auto" />
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="font-normal">
            Funder Workspace
          </Badge>
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              await signOut();
              navigate({ to: "/" });
            }}
          >
            Sign out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        <h1 className="text-lg font-semibold">Released counterparty information</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Only the fields, summary and documents an Izenzo admin has explicitly released to your
          organisation appear here. Nothing else about a counterparty, another funder's deals, or
          the wider platform is visible from this workspace.
        </p>

        <div className="mt-6">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : releases.length === 0 ? (
            <p className="text-sm text-muted-foreground">No releases available yet.</p>
          ) : (
            <ul className="space-y-4">
              {releases.map((r) => {
                const fields = (r.released_fields ?? {}) as Record<string, unknown>;
                const summary = (r.compliance_summary ?? {}) as Record<string, unknown>;
                const cpName = (r as { counterparties?: { name?: string } | null }).counterparties?.name;
                const decisions = (r as { funder_decisions?: { decision: string }[] }).funder_decisions ?? [];
                return (
                  <li
                    key={r.id}
                    className="rounded-md border border-border p-4"
                    onMouseEnter={() => recordView(r.id)}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{cpName ?? "Counterparty"}</p>
                        <p className="text-xs text-muted-foreground">
                          Pack {r.pack_version} · expires {new Date(r.expiry).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge variant="secondary" className="font-normal">
                        {r.permissions === "view_and_download" ? "View & download" : "View only"}
                      </Badge>
                    </div>

                    <div className="mt-3 grid gap-1.5 text-xs sm:grid-cols-2">
                      {Object.entries(fields)
                        .filter(([, v]) => v)
                        .map(([key]) => (
                          <p key={key}>
                            <span className="text-muted-foreground">{FIELD_LABEL[key] ?? key}:</span>{" "}
                            <span className="font-medium">released</span>
                          </p>
                        ))}
                    </div>

                    {Object.keys(summary).length > 0 && (
                      <div className="mt-3 rounded-md bg-muted/40 p-2.5 text-xs">
                        <p className="font-medium text-muted-foreground">Compliance summary</p>
                        {Object.entries(summary).map(([key, v]) => (
                          <p key={key} className="mt-0.5">
                            {key}: {String(v)}
                          </p>
                        ))}
                      </div>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      {decisions.length > 0 && (
                        <Badge variant="outline" className="font-normal">
                          Last decision: {DECISION_LABEL[decisions[decisions.length - 1]!.decision]}
                        </Badge>
                      )}
                      <Button size="sm" variant="outline" onClick={() => recordDecision(r.id, "recommend_fund")}>
                        Recommend funding
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => recordDecision(r.id, "request_more_info")}>
                        Request more info
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => recordDecision(r.id, "decline")}>
                        Decline
                      </Button>
                      {r.permissions === "view_and_download" &&
                        packs.find((p) => p.funder_release_id === r.id) && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownload(packs.find((p) => p.funder_release_id === r.id)!.id)}
                          >
                            Download evidence pack
                          </Button>
                        )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
