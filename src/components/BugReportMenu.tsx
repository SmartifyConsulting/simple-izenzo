import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bug,
  CheckCircle2,
  ImageIcon,
  Loader2,
  Mic,
  RotateCcw,
  Search,
  Send,
  Square,
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
  image_path: string | null;
};

const TYPE_META: Record<ReportType, { icon: typeof Bug | null; border: string; label: string }> = {
  bug: { icon: Bug, border: "border-l-destructive", label: "Bug" },
  fix: { icon: null, border: "border-l-primary", label: "Fix" },
  nice_to_have: { icon: null, border: "border-l-muted-foreground", label: "Nice to have" },
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
      // image_path isn't in the generated Supabase types yet (migration 0012 adds the column) —
      // cast through unknown until types are regenerated after that migration runs.
      return (data ?? []) as unknown as BugReport[];
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

  // A screenshot dropped straight onto a record — attached to that report, not a separate upload
  // flow. One image per report: dropping a new one replaces whatever was there.
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const attachImage = useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const path = `${id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("bug-report-images").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      // Cast through unknown for the same reason as the read above — image_path predates the
      // regenerated types.
      const { error } = await supabase
        .from("bug_reports")
        .update({ image_path: path } as unknown as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Screenshot attached");
      void queryClient.invalidateQueries({ queryKey: ["bug-reports"] });
    },
    onError: (e: Error) => toast.error(e.message || "Could not attach the screenshot"),
  });

  function imageUrl(path: string) {
    return supabase.storage.from("bug-report-images").getPublicUrl(path).data.publicUrl;
  }

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
            {(["all", "bug"] as const).map((t) => (
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
              const dragOver = dragOverId === r.id;
              return (
                <div
                  key={r.id}
                  onDragOver={(e) => {
                    if (!e.dataTransfer.types.includes("Files")) return;
                    e.preventDefault();
                    setDragOverId(r.id);
                  }}
                  onDragLeave={() => setDragOverId((id) => (id === r.id ? null : id))}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverId(null);
                    const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith("image/"));
                    if (!file) {
                      toast.error("Drop an image file to attach it.");
                      return;
                    }
                    attachImage.mutate({ id: r.id, file });
                  }}
                  className={`space-y-1 rounded-lg border border-l-4 border-border p-2.5 transition-colors ${meta.border} ${
                    dragOver ? "border-primary bg-primary/5" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                      {Icon && <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />}
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
                  {r.image_path ? (
                    <a href={imageUrl(r.image_path)} target="_blank" rel="noreferrer">
                      <img
                        src={imageUrl(r.image_path)}
                        alt="Attached screenshot"
                        className="mt-1 max-h-32 rounded-md border border-border object-cover"
                      />
                    </a>
                  ) : (
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground/70">
                      <ImageIcon className="h-3 w-3" />
                      Drop a screenshot here to attach it
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
