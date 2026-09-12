import { useCallback, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FileCheck2, Loader2, UploadCloud, IdCard, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { classifyDocument } from "@/lib/izenzo.functions";
import { summarizeBidDocuments } from "@/lib/docSummary.functions";
import { advance, fingerprintOf, recordEvent, shortHash } from "@/lib/tx";
import { cn } from "@/lib/utils";

/** Photos are the ID capture — only one is allowed per deal. */
const IMAGE_NAME = /\.(jpe?g|png|webp|gif|heic|heif)$/i;

const DOC_TYPE_LABEL: Record<string, string> = {
  identity: "ID document",
  term_sheet: "Term sheet",
  specification: "Specification",
  certificate: "Certificate",
  contract: "Contract",
  other: "Deal document",
};

/** Step 2 of the Simple Mode bid wizard — drag-and-drop upload for ID and deal documents, with
 * the document type guessed by AI (see classifyDocument) rather than picked from a dropdown. */
export function DocumentUploadStep({
  transactionId,
  onNext,
  onFirstClassified,
  autoAdvance = false,
}: {
  transactionId: string;
  onNext: () => void;
  /** Fires once, with the very first document ever attached to this transaction — lets the
   * caller correct a bid/offer's direction from what the document actually looks like, rather
   * than a side picked before any document existed. */
  onFirstClassified?: (info: { docType: string; directionGuess: "bid" | "offer" | null }) => void;
  /** Skips the manual "Next" button — the moment the first upload succeeds, moves on by itself.
   * Used where there's nothing else to review on this screen (e.g. going straight into search),
   * as opposed to a guided wizard step someone might want a beat to check before continuing. */
  autoAdvance?: boolean;
}) {
  const qc = useQueryClient();
  const classify = useServerFn(classifyDocument);
  const summarize = useServerFn(summarizeBidDocuments);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [reading, setReading] = useState(false);
  const [prompt, setPrompt] = useState("");

  /** Keeps the typed description on the deal so the search reads it alongside the documents. */
  const savePrompt = useCallback(async () => {
    const value = prompt.trim();
    const { error } = await supabase
      .from("transactions")
      .update({ search_prompt: value.length > 0 ? value : null })
      .eq("id", transactionId);
    if (error) toast.error(`Your description could not be saved: ${error.message}`);
    else await qc.invalidateQueries({ queryKey: ["transaction", transactionId] });
  }, [prompt, transactionId, qc]);

  const { data: docs = [] } = useQuery({
    queryKey: ["documents", transactionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("transaction_id", transactionId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      let list = Array.from(files);
      if (list.length === 0) return;

      // One ID photo only — written documents (PDF, Word, Excel, CSV, text) have no limit.
      const alreadyHasImage = docs.some((d) => IMAGE_NAME.test(String(d.name)));
      const images = list.filter((f) => IMAGE_NAME.test(f.name));
      if (images.length > 0 && (alreadyHasImage || images.length > 1)) {
        const keep = alreadyHasImage ? null : images[0];
        const dropped = images.filter((f) => f !== keep).map((f) => f.name);
        list = list.filter((f) => !dropped.includes(f.name));
        toast.info(
          alreadyHasImage
            ? "Only one photo can be attached — the extra photo was not added."
            : "Only one photo can be attached — the first one was kept.",
        );
        if (list.length === 0) return;
      }

      setUploading(true);
      await savePrompt();
      const isFirstEver = docs.length === 0;
      try {
        for (const [i, file] of list.entries()) {
          const { docType, directionGuess } = await classify({ data: { filename: file.name } });
          if (isFirstEver && i === 0) onFirstClassified?.({ docType, directionGuess });

          let storagePath: string | null = null;
          const path = `deals/${transactionId}/${Date.now()}-${file.name}`;
          const { error: upErr } = await supabase.storage.from("documents").upload(path, file);
          if (!upErr) storagePath = path;

          const sha = await fingerprintOf({ name: file.name, size: file.size, at: Date.now() });
          const { error } = await supabase.from("documents").insert({
            transaction_id: transactionId,
            name: file.name,
            doc_type: docType,
            notes: null,
            version: 1,
            sha256: sha,
            storage_path: storagePath,
          });
          if (error) throw error;

          await recordEvent({
            transactionId,
            stage: "trading",
            step: "documents",
            action: "document_attached",
            summary: `${file.name} — classified as ${DOC_TYPE_LABEL[docType] ?? docType}`,
            payload: { name: file.name, doc_type: docType, sha256: sha },
          });
        }
        await qc.invalidateQueries({ queryKey: ["documents", transactionId] });
        toast.success(list.length === 1 ? "Document uploaded" : `${list.length} documents uploaded`);

        // Read what the files actually say — the photo by sight, written documents by their text —
        // so the ask is summarised and the search has real details to work from.
        setReading(true);
        try {
          await summarize({ data: { transactionId } });
          await qc.invalidateQueries({ queryKey: ["transaction", transactionId] });
          await qc.invalidateQueries({ queryKey: ["tx", transactionId] });
          toast.success("Documents read — summary ready");
        } catch (err) {
          toast.error(`Uploaded, but the documents could not be read: ${(err as Error).message}`);
        } finally {
          setReading(false);
        }

        if (autoAdvance) await next();
      } catch (err) {
        toast.error((err as Error).message);
      } finally {
        setUploading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [classify, summarize, transactionId, qc, autoAdvance, docs, savePrompt],
  );

  async function next() {
    await advance(transactionId, "trading", "search");
    onNext();
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="deal-search-prompt" className="text-xs font-medium">
          Search Prompt
        </Label>
        <Textarea
          id="deal-search-prompt"
          rows={3}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onBlur={savePrompt}
          placeholder="Describe what you're looking for — product, quantity, location, terms"
          className="resize-none text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Used together with your attached documents to find matches.
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length) void handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors",
          dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
        )}
      >
        {uploading || reading ? (
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        ) : (
          <UploadCloud className="h-6 w-6 text-muted-foreground" />
        )}
        <p className="text-sm font-medium">
          {reading ? "Reading your documents…" : "Drag and drop ID or deal documents here"}
        </p>
        <p className="text-xs text-muted-foreground">
          {reading
            ? "Pulling out the ask, quantities, prices and terms"
            : "One photo of your ID, plus any written documents (PDF, Word, Excel, CSV, text)"}
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {docs.length > 0 && (
        <ul className="space-y-2">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm">
              {d.doc_type === "identity" ? (
                <IdCard className="h-4 w-4 shrink-0 text-primary" />
              ) : (
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{d.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {DOC_TYPE_LABEL[d.doc_type] ?? d.doc_type} · {shortHash(d.sha256)}
                </p>
              </div>
              <FileCheck2 className="h-4 w-4 shrink-0 text-success" />
            </li>
          ))}
        </ul>
      )}

      {!autoAdvance && (
        <Button className="w-full" disabled={docs.length === 0 || uploading || reading} onClick={next}>
          Next
        </Button>
      )}
    </div>
  );
}
