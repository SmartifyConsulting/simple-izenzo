import { useRef, useState, type ClipboardEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Bug,
  CheckCircle2,
  FileText,
  ImageIcon,
  Loader2,
  Mic,
  Plus,
  RotateCcw,
  Search,
  Square,
  UploadCloud,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { readBugAttachment } from "@/lib/documents.functions";

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
  attachment_paths: string[] | null;
};

const TYPE_META: Record<ReportType, { icon: typeof Bug | null; border: string; label: string }> = {
  bug: { icon: Bug, border: "border-l-destructive", label: "Bug" },
  fix: { icon: null, border: "border-l-primary", label: "Fix" },
  nice_to_have: { icon: null, border: "border-l-muted-foreground", label: "Nice to have" },
};

const IMAGE_NAME = /\.(png|jpe?g|webp|gif|heic|heif)$/i;

type ReadAttachment = (args: { data: { path: string } }) => Promise<{ base64: string; contentType: string }>;

const attachmentUrlCache = new Map<string, string>();

/** Reads the file through this app's own server (never the storage host, which some browsers and
 * extensions block outright) and hands back a local address the page can show or download. */
async function attachmentUrl(read: ReadAttachment, path: string): Promise<string> {
  const cached = attachmentUrlCache.get(path);
  if (cached) return cached;
  const { base64, contentType } = await read({ data: { path } });
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: contentType }));
  attachmentUrlCache.set(path, url);
  return url;
}

function AttachmentThumb({ path, onOpen }: { path: string; onOpen: (path: string) => void }) {
  const read = useServerFn(readBugAttachment);
  const { data: url, isError } = useQuery({
    queryKey: ["bug-attachment-url", path],
    staleTime: 30 * 60 * 1000,
    queryFn: () => attachmentUrl(read, path),
  });
  return (
    <button type="button" onClick={() => onOpen(path)} className="shrink-0" title="View screenshot">
      {url ? (
        <img
          src={url}
          alt="Attached screenshot"
          className="h-16 w-16 rounded-md border border-border object-cover transition-opacity hover:opacity-80"
        />
      ) : (
        <span className="flex h-16 w-16 items-center justify-center rounded-md border border-border text-muted-foreground">
          {isError ? <ImageIcon className="h-5 w-5" /> : <Loader2 className="h-4 w-4 animate-spin" />}
        </span>
      )}
    </button>
  );
}

/** Every attachment a report has on file — the legacy single image_path (pre-modal reports) plus
 * the newer attachment_paths array, so nothing filed before this modal existed disappears. */
function attachmentsOf(r: BugReport): string[] {
  const fromArray = r.attachment_paths ?? [];
  if (r.image_path && !fromArray.includes(r.image_path)) return [r.image_path, ...fromArray];
  return fromArray;
}

/** Bug / fix / nice-to-have reporting, opened from the bug icon beside the inbox icon. */
export function BugReportMenu() {
  const { user, profile, roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [text, setText] = useState("");
  const [type] = useState<ReportType>("bug");
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"open" | "done" | "all">("open");

  // Staged in the composer modal until Send — screenshots and any other file, dropped or browsed.
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [composerDragOver, setComposerDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      // attachment_paths/image_path predate the regenerated Supabase types — cast through unknown
      // until types are regenerated after those migrations run.
      return (data ?? []) as unknown as BugReport[];
    },
  });

  function addPendingFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;
    setPendingFiles((prev) => [...prev, ...list]);
  }

  function removePendingFile(index: number) {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  }

  /** Ctrl+V of a screenshot copied from Paint/Snipping Tool/anywhere else — the clipboard carries
   * the image data directly, with no need to save it to a file first. */
  function handlePaste(e: ClipboardEvent<HTMLDivElement>) {
    const images = Array.from(e.clipboardData.items)
      .filter((item) => item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((f): f is File => f !== null);
    if (images.length === 0) return;
    e.preventDefault();
    const named = images.map(
      (f, i) => new File([f], f.name || `pasted-screenshot-${Date.now()}-${i}.png`, { type: f.type }),
    );
    addPendingFiles(named);
  }

  // Full-size look at one attachment — the thumbnail grid is too small to actually read a
  // screenshot.
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const readAttachment = useServerFn(readBugAttachment);
  async function openAttachment(path: string) {
    try {
      const url = await attachmentUrl(readAttachment, path);
      if (IMAGE_NAME.test(path)) {
        setPreviewUrl(url);
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.download = path.split("/").slice(1).join("/") || "attachment";
        a.click();
      }
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const submitMutation = useMutation({
    mutationFn: async ({ title, via, files }: { title: string; via: "typed" | "voice"; files: File[] }) => {
      const trimmed = title.trim();
      if (!trimmed) throw new Error("Nothing to send yet.");
      if (!user) throw new Error("Please sign in first.");
      const displayName =
        profile?.full_name || profile?.email || user.email?.split("@")[0] || "Unknown";
      const { data: inserted, error } = await supabase
        .from("bug_reports")
        .insert({
          user_id: user.id,
          display_name: displayName,
          type,
          title: trimmed.slice(0, 300),
          created_via: via,
        })
        .select()
        .single();
      if (error) throw error;

      if (files.length > 0 && inserted) {
        const paths: string[] = [];
        for (const file of files) {
          const path = `${inserted.id}/${Date.now()}-${file.name}`;
          const { error: upErr } = await supabase.storage.from("bug-report-images").upload(path, file);
          if (!upErr) paths.push(path);
        }
        if (paths.length > 0) {
          await supabase
            .from("bug_reports")
            .update({ attachment_paths: paths } as unknown as never)
            .eq("id", inserted.id);
        }
      }
    },
    onSuccess: () => {
      toast.success("Thanks — report submitted");
      setText("");
      setPendingFiles([]);
      setComposerOpen(false);
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

  // A file dropped straight onto an existing record — appended to whatever's already attached,
  // not a replacement.
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const attachFiles = useMutation({
    mutationFn: async ({ id, files, existing }: { id: string; files: File[]; existing: string[] }) => {
      const paths: string[] = [];
      for (const file of files) {
        const path = `${id}/${Date.now()}-${file.name}`;
        const { error: upErr } = await supabase.storage.from("bug-report-images").upload(path, file);
        if (!upErr) paths.push(path);
      }
      if (paths.length === 0) throw new Error("Could not upload the file.");
      const { error } = await supabase
        .from("bug_reports")
        .update({ attachment_paths: [...existing, ...paths] } as unknown as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Attached");
      void queryClient.invalidateQueries({ queryKey: ["bug-reports"] });
    },
    onError: (e: Error) => toast.error(e.message || "Could not attach the file"),
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
      await submitMutation.mutateAsync({ title: transcript, via: "voice", files: pendingFiles });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Transcription failed");
    } finally {
      setTranscribing(false);
    }
  }

  const q = search.trim().toLowerCase();
  const filtered = reports.filter((r) => {
    if (!q) return true;
    return (
      r.title.toLowerCase().includes(q) ||
      (r.description ?? "").toLowerCase().includes(q) ||
      (r.display_name ?? "").toLowerCase().includes(q)
    );
  });

  const busy = submitMutation.isPending || transcribing;

  return (
    <>
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

        <Button type="button" className="w-full gap-1.5" onClick={() => setComposerOpen(true)}>
          <Plus className="h-4 w-4" /> New Bug/Fix
        </Button>

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
              const attachments = attachmentsOf(r);
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
                    const files = Array.from(e.dataTransfer.files);
                    if (files.length === 0) return;
                    attachFiles.mutate({ id: r.id, files, existing: attachments });
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
                  {attachments.length > 0 ? (
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {attachments.map((path, i) =>
                        IMAGE_NAME.test(path) ? (
                          <AttachmentThumb key={i} path={path} onOpen={(p) => void openAttachment(p)} />
                        ) : (
                          <button
                            key={i}
                            type="button"
                            onClick={() => void openAttachment(path)}
                            className="flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] text-foreground hover:border-primary/50"
                          >
                            <FileText className="h-3 w-3 shrink-0" />
                            {path.split("/").slice(1).join("/")}
                          </button>
                        ),
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground/70">
                      <ImageIcon className="h-3 w-3" />
                      Drop a screenshot or file here to attach it
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </SheetContent>
    </Sheet>

    <Dialog open={composerOpen} onOpenChange={(v) => !busy && setComposerOpen(v)}>
      <DialogContent className="sm:max-w-md" onPaste={handlePaste}>
        <DialogHeader>
          <DialogTitle>New Bug/Fix</DialogTitle>
          <DialogDescription>
            Type it, or record a voice note — paste a screenshot straight from Paint/Snipping Tool
            (Ctrl+V) or drop any file.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-1.5">
          <Textarea
            placeholder="What's the bug or fix?"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={300}
            rows={3}
            className="flex-1 text-sm"
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
        </div>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setComposerDragOver(true);
          }}
          onDragLeave={() => setComposerDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setComposerDragOver(false);
            if (e.dataTransfer.files.length) addPendingFiles(e.dataTransfer.files);
          }}
          className={`flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed p-5 text-center transition-colors ${
            composerDragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
          }`}
        >
          <UploadCloud className="h-5 w-5 text-muted-foreground" />
          <span className="text-xs font-medium">Drop screenshots or files here, or click to browse</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addPendingFiles(e.target.files);
            e.target.value = "";
          }}
        />

        {pendingFiles.length > 0 && (
          <ul className="space-y-1">
            {pendingFiles.map((f, i) => (
              <li
                key={i}
                className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-xs"
              >
                {IMAGE_NAME.test(f.name) ? (
                  <ImageIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )}
                <span className="min-w-0 flex-1 truncate">{f.name}</span>
                <button
                  type="button"
                  onClick={() => removePendingFile(i)}
                  className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <DialogFooter>
          <Button
            type="button"
            disabled={!text.trim() || busy}
            onClick={() => submitMutation.mutate({ title: text, via: "typed", files: pendingFiles })}
          >
            {submitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={previewUrl !== null} onOpenChange={(v) => !v && setPreviewUrl(null)}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Screenshot</DialogTitle>
        </DialogHeader>
        {previewUrl && (
          <img src={previewUrl} alt="Attached screenshot, full size" className="max-h-[75vh] w-full rounded-lg object-contain" />
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}
