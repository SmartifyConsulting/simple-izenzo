import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { analyseCase, draftCaseSummary } from "@/lib/caseAi.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/case/$ref")({
  head: ({ params }) => ({
    meta: [
      { title: `Case ${params.ref} — Izenzo Investigations` },
      { name: "description", content: "Work an investigation: evidence, AI+ leads, Without a Doubt checks and closure." },
      { property: "og:title", content: `Case ${params.ref} — Izenzo Investigations` },
      { property: "og:description", content: "Evidence, AI+ leads, Without a Doubt checks and case closure." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CasePage,
});

const db = supabase as any;

const WAD = [
  { key: "agency", label: "Investigator agency confirmed" },
  { key: "mandate", label: "Mandate to investigate" },
  { key: "jurisdiction", label: "Jurisdiction established" },
  { key: "legal_authority", label: "Legal authority held (warrant / subpoena / consent)" },
  { key: "chain_of_custody", label: "Chain of custody intact" },
];

const OUTCOMES = [
  { key: "actioned", label: "Closed — actioned" },
  { key: "no_further_action", label: "Closed — no further action" },
  { key: "referred", label: "Referred" },
];

function Section({ n, title, children, done }: { n: number; title: string; children: React.ReactNode; done?: boolean }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
        <span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm ${done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function when(s: string) {
  return new Date(s).toLocaleString();
}

function CasePage() {
  const { ref } = Route.useParams();
  const qc = useQueryClient();
  const auth = useAuth() as any;
  const user = auth.user;
  const myName: string = user?.user_metadata?.full_name ?? user?.email ?? "Investigator";
  const analyse = useServerFn(analyseCase);
  const draft = useServerFn(draftCaseSummary);

  const caseQ = useQuery({
    queryKey: ["case", ref],
    queryFn: async () => {
      const { data: tx } = await db.from("transactions").select("id, reference, title, search_prompt, jurisdiction, org_id").eq("reference", ref).maybeSingle();
      if (!tx) return null;
      const [ev, leads, wad, closure] = await Promise.all([
        db.from("case_evidence").select("*").eq("transaction_id", tx.id).order("created_at"),
        db.from("case_leads").select("*").eq("transaction_id", tx.id).order("created_at"),
        db.from("case_wad_checks").select("*").eq("transaction_id", tx.id).order("created_at"),
        db.from("case_closures").select("*").eq("transaction_id", tx.id).maybeSingle(),
      ]);
      return { tx, evidence: ev.data ?? [], leads: leads.data ?? [], wad: wad.data ?? [], closure: closure.data };
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["case", ref] });

  const [files, setFiles] = useState<File[]>([]);
  const [source, setSource] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [outcome, setOutcome] = useState("actioned");
  const [closeNote, setCloseNote] = useState("");
  const [summary, setSummary] = useState("");
  const [followUp, setFollowUp] = useState(false);

  if (caseQ.isLoading) return <div className="p-8 text-muted-foreground">Loading case…</div>;
  const c = caseQ.data;
  if (!c) return <div className="p-8">Case {ref} not found or you don't have access.</div>;
  const { tx, evidence, leads, wad, closure } = c;
  const closed = Boolean(closure);

  const latestWad = new Map<string, any>();
  for (const w of wad) latestWad.set(w.check_key, w);
  const wadDone = WAD.every((w) => latestWad.get(w.key)?.passed);

  async function addEvidence() {
    if (files.length === 0 && !note.trim()) return toast.error("Add a file or a note.");
    setBusy("evidence");
    try {
      const rows: any[] = [];
      const items = files.length ? files : [null];
      for (const f of items) {
        let storage_path: string | null = null;
        let sha256: string | null = null;
        if (f) {
          const buf = await f.arrayBuffer();
          const hash = await crypto.subtle.digest("SHA-256", buf);
          sha256 = Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
          storage_path = `${tx.org_id}/${tx.id}/evidence/${Date.now()}-${f.name}`;
          const { error } = await supabase.storage.from("documents").upload(storage_path, f);
          if (error) throw error;
        }
        rows.push({ transaction_id: tx.id, file_name: f?.name ?? null, storage_path, sha256, source: source || null, note: note || null, added_by: user.id, added_by_name: myName });
      }
      const { error } = await db.from("case_evidence").insert(rows);
      if (error) throw error;
      setFiles([]); setNote(""); setSource("");
      toast.success("Evidence logged");
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function runAi() {
    setBusy("ai");
    try {
      const r = await analyse({ data: { transactionId: tx.id } });
      toast.success(`AI+ proposed ${r.count} leads`);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function decide(id: string, decision: "accepted" | "rejected") {
    const { error } = await db.from("case_leads").update({ decision, decided_by: user.id, decided_by_name: myName }).eq("id", id);
    if (error) toast.error(error.message); else refresh();
  }

  async function recordWad(key: string, passed: boolean) {
    const { error } = await db.from("case_wad_checks").insert({ transaction_id: tx.id, check_key: key, passed, recorded_by: user.id, recorded_by_name: myName });
    if (error) toast.error(error.message);
    else { if (!passed) toast.warning("Failed check logged permanently in Memory"); refresh(); }
  }

  async function draftSummary() {
    setBusy("summary");
    try {
      const r = await draft({ data: { transactionId: tx.id } });
      setSummary(r.summary);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function closeCase() {
    setBusy("close");
    try {
      let follow: string | null = null;
      if (followUp) {
        const { data: nt, error } = await db
          .from("transactions")
          .insert({ org_id: tx.org_id, created_by: user.id, title: `Follow-up: ${tx.title}`, search_prompt: `Follow-up cycle from ${tx.reference}. ${summary}`.slice(0, 2000), jurisdiction: tx.jurisdiction, reference: `INV${Math.floor(1000000 + Math.random() * 8999999)}` })
          .select("id")
          .single();
        if (error) throw error;
        follow = nt.id;
      }
      const { error } = await db.from("case_closures").insert({ transaction_id: tx.id, outcome, note: closeNote || null, summary: summary || null, follow_up_transaction_id: follow, closed_by: user.id, closed_by_name: myName });
      if (error) throw error;
      toast.success("Case closed");
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-6">
      <div>
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← All cases</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <span className="font-mono text-xl font-bold text-primary">{tx.reference}</span>
          <span className={`rounded-full px-3 py-0.5 text-xs font-semibold ${closed ? "bg-muted text-muted-foreground" : "bg-primary/15 text-primary"}`}>{closed ? "Closed" : "Open"}</span>
        </div>
        <h1 className="mt-1 text-2xl font-semibold">{tx.title}</h1>
      </div>

      <Section n={1} title="Starting Evidence" done={evidence.length > 0}>
        <p className="mb-4 whitespace-pre-wrap text-sm text-muted-foreground">{tx.search_prompt}</p>
        <ul className="mb-4 space-y-2">
          {evidence.map((e: any) => (
            <li key={e.id} className="rounded-lg border border-border p-3 text-sm">
              <div className="font-medium">{e.file_name ?? "Note"}{e.source ? ` · ${e.source}` : ""}</div>
              {e.note && <div className="text-muted-foreground">{e.note}</div>}
              <div className="mt-1 text-xs text-muted-foreground">Logged by {e.added_by_name} · {when(e.created_at)}{e.sha256 ? ` · SHA-256 ${e.sha256.slice(0, 12)}…` : ""}</div>
            </li>
          ))}
        </ul>
        {!closed && (
          <div className="space-y-2 rounded-lg bg-muted/40 p-3">
            <Input type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
            {files.length > 0 && <p className="text-xs text-muted-foreground">{files.length} file(s) ready</p>}
            <Input placeholder="Source (e.g. bank, telco, victim statement)" value={source} onChange={(e) => setSource(e.target.value)} />
            <Textarea placeholder="Note" value={note} onChange={(e) => setNote(e.target.value)} />
            <Button onClick={addEvidence} disabled={busy === "evidence"}>{busy === "evidence" ? "Logging…" : "Log evidence"}</Button>
            <p className="text-xs text-muted-foreground">Logged evidence can't be edited or removed — only added to.</p>
          </div>
        )}
      </Section>

      <Section n={2} title="AI+ Analysis (advisory)" done={leads.some((l: any) => l.decision === "accepted")}>
        {!closed && <Button onClick={runAi} disabled={busy === "ai"} className="mb-4">{busy === "ai" ? "Analysing…" : "Run AI+ analysis"}</Button>}
        <div className="space-y-3">
          {leads.map((l: any) => (
            <div key={l.id} className="rounded-lg border border-border p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-muted px-2 py-0.5 text-xs font-semibold uppercase">{l.direction}</span>
                <span className="font-medium">{l.title}</span>
                {l.effect && <span className="text-xs text-muted-foreground">· {l.effect}</span>}
              </div>
              <dl className="mt-2 grid gap-1 text-muted-foreground sm:grid-cols-2">
                <div><b>Reason:</b> {l.reason}</div>
                <div><b>Evidence basis:</b> {l.evidence_basis}</div>
                <div><b>Expected result:</b> {l.expected_result}</div>
                <div><b>Authority required:</b> {l.authority_required}</div>
              </dl>
              {l.decision ? (
                <p className="mt-2 text-xs font-medium">{l.decision === "accepted" ? "Accepted" : "Rejected"} by {l.decided_by_name} · {when(l.decided_at)}</p>
              ) : !closed ? (
                <div className="mt-2 flex gap-2">
                  <Button size="sm" onClick={() => decide(l.id, "accepted")}>Accept</Button>
                  <Button size="sm" variant="outline" onClick={() => decide(l.id, "rejected")}>Reject</Button>
                </div>
              ) : null}
            </div>
          ))}
          {leads.length === 0 && <p className="text-sm text-muted-foreground">No leads yet.</p>}
        </div>
      </Section>

      <Section n={3} title="Freeze Intent — Without a Doubt" done={wadDone}>
        <div className="space-y-2">
          {WAD.map((w) => {
            const last = latestWad.get(w.key);
            return (
              <div key={w.key} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm">
                <div>
                  <div className="font-medium">{w.label}</div>
                  {last && <div className="text-xs text-muted-foreground">{last.passed ? "Passed" : "Failed"} · {last.recorded_by_name} · {when(last.created_at)}</div>}
                </div>
                {!closed && (
                  <div className="flex gap-2">
                    <Button size="sm" variant={last?.passed ? "default" : "outline"} onClick={() => recordWad(w.key, true)}>Pass</Button>
                    <Button size="sm" variant="outline" onClick={() => recordWad(w.key, false)}>Fail</Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      <Section n={4} title="Execution — Case Closure" done={closed}>
        {closed ? (
          <div className="space-y-2 text-sm">
            <p><b>{OUTCOMES.find((o) => o.key === closure.outcome)?.label}</b> by {closure.closed_by_name} · {when(closure.created_at)}</p>
            {closure.note && <p>{closure.note}</p>}
            {closure.summary && <p className="whitespace-pre-wrap text-muted-foreground">{closure.summary}</p>}
          </div>
        ) : !wadDone ? (
          <p className="text-sm text-muted-foreground">All Without a Doubt checks must pass before the case can be closed.</p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {OUTCOMES.map((o) => (
                <Button key={o.key} size="sm" variant={outcome === o.key ? "default" : "outline"} onClick={() => setOutcome(o.key)}>{o.label}</Button>
              ))}
            </div>
            <Textarea placeholder="Closing note" value={closeNote} onChange={(e) => setCloseNote(e.target.value)} />
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={draftSummary} disabled={busy === "summary"}>{busy === "summary" ? "Drafting…" : "Draft AI summary"}</Button>
              <span className="text-xs text-muted-foreground">Review and edit before closing.</span>
            </div>
            <Textarea rows={6} placeholder="Case summary" value={summary} onChange={(e) => setSummary(e.target.value)} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={followUp} onChange={(e) => setFollowUp(e.target.checked)} />
              Open a follow-up case (next AI+ cycle)
            </label>
            <Button onClick={closeCase} disabled={busy === "close"}>{busy === "close" ? "Closing…" : "Close case"}</Button>
          </div>
        )}
      </Section>

      <Section n={5} title="Memory" done={closed}>
        <ul className="space-y-1 text-xs text-muted-foreground">
          {[
            ...evidence.map((e: any) => ({ t: e.created_at, s: `Evidence logged by ${e.added_by_name}: ${e.file_name ?? "note"}` })),
            ...leads.filter((l: any) => l.decision).map((l: any) => ({ t: l.decided_at, s: `Lead ${l.decision} by ${l.decided_by_name}: ${l.title}` })),
            ...wad.map((w: any) => ({ t: w.created_at, s: `WaD ${w.check_key} ${w.passed ? "passed" : "FAILED"} — ${w.recorded_by_name}` })),
            ...(closure ? [{ t: closure.created_at, s: `Case closed by ${closure.closed_by_name}` }] : []),
          ]
            .sort((a, b) => a.t.localeCompare(b.t))
            .map((m, i) => <li key={i}>{when(m.t)} — {m.s}</li>)}
        </ul>
      </Section>
    </div>
  );
}
