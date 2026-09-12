import { useCallback, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FileCheck2, Loader2, UploadCloud, IdCard, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { classifyDocument } from "@/lib/izenzo.functions";
import { advance, fingerprintOf, recordEvent, shortHash } from "@/lib/tx";
import { cn } from "@/lib/utils";

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
}: {
  transactionId: string;
  onNext: () => void;
  /** Fires once, with the very first document ever attached to this transaction — lets the
   * caller correct a bid/offer's direction from what the document actually looks like, rather
   * than a side picked before any document existed. */
  onFirstClassified?: (info: { docType: string; directionGuess: "bid" | "offer" | null }) => void;
}) {
  const qc = useQueryClient();
  const classify = useServerFn(classifyDocument);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);

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
      const list = Array.from(files);
      if (list.length === 0) return;
      setUploading(true);
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
      } catch (err) {
        toast.error((err as Error).message);
      } finally {
        setUploading(false);
      }
    },
    [classify, transactionId, qc],
  );

  async function next() {
    await advance(transactionId, "trading", "search");
    onNext();
  }

  return (
    <div className="space-y-4">
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
        {uploading ? (
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        ) : (
          <UploadCloud className="h-6 w-6 text-muted-foreground" />
        )}
        <p className="text-sm font-medium">Drag and drop ID or deal documents here</p>
        <p className="text-xs text-muted-foreground">or click to browse — AI determines the document type</p>
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

      <Button className="w-full" disabled={docs.length === 0 || uploading} onClick={next}>
        Next
      </Button>
    </div>
  );
}
