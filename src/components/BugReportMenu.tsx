import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bug,
  CheckCircle2,
  Loader2,
  Mic,
  RotateCcw,
  Search,
  Send,
  Sparkles,
  Square,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { transcribeBugReport } from "@/lib/bugReport.functions";

type ReportType = "bug" | "fix" | "nice_to_have";

type BugReport = {
  id: string;
  created_at: string;
  user_id: string;
  display_name: string | null;
  type: string;
  title: string;
  description: string | null;
  created_via: string;
  status: string;
};

const TYPE_META: Record<ReportType, { icon: typeof Bug; border: string; label: string }> = {
  bug: { icon: Bug, border: "border-l-destructive", label: "Bug" },
  fix: { icon: Wrench, border: "border-l-primary", label: "Fix" },
  nice_to_have: { icon: Sparkles, border: "border-l-muted-foreground", label: "Nice to have" },
};

/** Bug / fix / nice-to-have reporting, opened from the bug icon beside the inbox icon. */
export function BugReportMenu() {
  const { user, profile, roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [type, setType] = useState<ReportType>("bug");
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"open" | "done" | "all">("open");
  const [typeFilter, setTypeFilter] = useState<ReportType | "all">("all");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["bug-reports", statusFilter],
    enabled: open,
    queryFn: async () => {
      let query = supabase.from("bug_reports").select("*");
      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      const { data, error } = await query.order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return (data ?? []) as BugReport[];
    },
  });

  const submitMutation = useMutation({
    mutationFn: async ({ title, via }: { title: string; via: "typed" | "voice" }) => {
      const trimmed = title.trim();
      if (!trimmed) throw new Error("Nothing to send yet.");
      if (!user) throw new Error("Please sign in first.");
      const displayName =
        profile?.full_name || profile?.email || user.email?.split("@")[0] || "Unknown";
      const { error } = await supabase.from("bug_reports").insert({
        user_id: user.id,
        display_name: displayName,
        type,
        title: trimmed.slice(0, 300),
        created_via: via,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Thanks — report submitted");
      setText("");
      void queryClient.invalidateQueries({ queryKey: ["bug-reports"] });
    },
    onError: (e: Error) => toast.error(e.message || "Failed to submit"),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "open" | "done" }) => {
      const { error } = await supabase.from("bug_reports").update({ status }).eq("id", id);
      if (error) throw error;
      return status;
    },
    onSuccess: (status) => {
      toast.success(status === "done" ? "Marked as done" : "Reopened");
      void queryClient.invalidateQueries({ queryKey: ["bug-reports"] });
    },
    onError: () => toast.error("Failed to update"),
  });

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        await transcribeAndSubmit(blob);
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
    } catch (e) {
      console.error(e);
      toast.error("Microphone access denied");
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  }

  async function transcribeAndSubmit(blob: Blob) {
    setTranscribing(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      const { text: transcript } = await transcribeBugReport({
        data: { audioBase64: base64, mimeType: blob.type },
      });
      await submitMutation.mutateAsync({ title: transcript, via: "voice" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Transcription failed");
    } finally {
      setTranscribing(false);
    }
  }

  const q = search.trim().toLowerCase();
  const filtered = reports.filter((r) => {
    if (typeFilter !== "all" && r.type !== typeFilter) return false;
    if (!q) return true;
    return (
      r.title.toLowerCase().includes(q) ||
      (r.description ?? "").toLowerCase().includes(q) ||
      (r.display_name ?? "").toLowerCase().includes(q)
    );
  });

  const busy = submitMutation.isPending || transcribing;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label="Report a bug"
        title="Report a bug"
        className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-foreground/80 outline-none transition-colors hover:text-primary"
      >
        <Bug className="h-5 w-5" strokeWidth={2.25} />
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-3 overflow-y-auto sm:max-w-md">
        <SheetHeader className="pb-0">
          <SheetTitle className="flex items-center gap-2 text-base">
            Report a bug or fix
            <Badge variant="outline" className="border-primary/40 text-[10px] font-normal text-primary">
              Beta
            </Badge>
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-wrap items-center gap-1.5">
          {(Object.keys(TYPE_META) as ReportType[]).map((t) => {
            const Icon = TYPE_META[t].icon;
            const active = type === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {TYPE_META[t].label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5">
          <Input
            placeholder={`Report a ${TYPE_META[type].label.toLowerCase()}…`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submitMutation.mutate({ title: text, via: "typed" });
              }
            }}
            maxLength={300}
            className="h-10 flex-1 text-sm"
            disabled={busy}
          />
          <Button
            type="button"
            onClick={recording ? stopRecording : () => void startRecording()}
            disabled={busy}
            size="icon"
            variant={recording ? "destructive" : "secondary"}
            className="h-10 w-10 shrink-0"
            title={recording ? "Stop recording" : "Record a voice note"}
          >
            {transcribing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : recording ? (
              <Square className="h-4 w-4" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </Button>
          <Button
            type="button"
            onClick={() => submitMutation.mutate({ title: text, via: "typed" })}
            disabled={!text.trim() || busy}
            size="icon"
            className="h-10 w-10 shrink-0 rounded-full"
          >
            {submitMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search reports…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-8 text-sm"
          />
        </div>

        {isAdmin && (
          <div className="flex flex-wrap items-center gap-1.5">
            {(["open", "done", "all"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition ${
                  statusFilter === s
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {s}
              </button>
            ))}
            <span className="mx-1 h-4 w-px bg-border" />
            {(["all", ...(Object.keys(TYPE_META) as ReportType[])] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(t as ReportType | "all")}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  typeFilter === t
                    ? "bg-secondary text-secondary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {t === "all" ? "All types" : TYPE_META[t as ReportType].label}
              </button>
            ))}
          </div>
        )}

        <h3 className="text-sm font-semibold">
          {isAdmin && statusFilter !== "open" ? "Reports" : "Outstanding"} ({filtered.length})
        </h3>

        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-3 text-center text-sm text-muted-foreground">
            {search ? "No matching reports" : "No outstanding reports"}
          </p>
        ) : (
          <div className="space-y-1.5">
            {filtered.map((r) => {
              const meta = TYPE_META[r.type as ReportType] ?? TYPE_META.bug;
              const Icon = meta.icon;
              return (
                <div
                  key={r.id}
                  className={`space-y-1 rounded-lg border border-l-4 border-border p-2.5 ${meta.border}`}
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="break-words text-sm font-medium">{r.title}</span>
                      {r.created_via === "voice" && (
                        <Mic className="h-3 w-3 text-muted-foreground" />
                      )}
                    </div>
                    {isAdmin && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 shrink-0"
                        title={r.status === "done" ? "Reopen" : "Mark as done"}
                        onClick={() =>
                          setStatus.mutate({
                            id: r.id,
                            status: r.status === "done" ? "open" : "done",
                          })
                        }
                      >
                        {r.status === "done" ? (
                          <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                        )}
                      </Button>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {r.display_name ?? "Unknown"} · {new Date(r.created_at).toLocaleDateString()}
                    {isAdmin && r.status === "done" && " · done"}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
