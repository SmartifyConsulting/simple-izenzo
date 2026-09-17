import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, ClipboardCheck, Download, Loader2, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import {
  AUTHORIZED_SIGNERS,
  DOCUMENT_INTRO,
  PROJECT_NAME,
  UAT_CHECKLIST,
  matchAuthorizedSigner,
  signUatDocument,
} from "@/lib/uatSignoff.functions";

type SignoffRow = { id: string; signer_name: string; signed_at: string; pdf_path: string; pdf_name: string };

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

/** Draws the entered name in the same cursive face shown on screen, onto an offscreen canvas, so
 * the PNG handed to the server for the final PDF is pixel-for-pixel what the signer previewed and
 * confirmed — no drawing pad, nothing invented server-side. */
async function renderSignatureImage(name: string): Promise<string> {
  await document.fonts.load('64px "Great Vibes"');
  await document.fonts.ready;
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 180;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#111111";
  ctx.font = '64px "Great Vibes", cursive';
  ctx.textBaseline = "middle";
  ctx.fillText(name, 16, canvas.height / 2);
  return canvas.toDataURL("image/png");
}

export function UatSignoffDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const signFn = useServerFn(signUatDocument);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: signoffs = [] } = useQuery({
    queryKey: ["uat-signoffs"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await (supabase.from("uat_signoffs" as never) as any).select("*");
      if (error) throw error;
      return (data ?? []) as SignoffRow[];
    },
  });

  const matched = matchAuthorizedSigner(name);
  const existingForMatch = matched ? signoffs.find((s) => s.signer_name === matched) : undefined;
  const showValidationError = name.trim().length > 0 && !matched;

  // The signature preview is generated a beat after typing stops, from the same font used in the
  // final PDF — regenerating on every keystroke would be wasteful and would flicker.
  useEffect(() => {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    if (!matched || existingForMatch) {
      setSignaturePreview(null);
      return;
    }
    previewTimer.current = setTimeout(() => {
      void renderSignatureImage(matched).then(setSignaturePreview);
    }, 300);
    return () => {
      if (previewTimer.current) clearTimeout(previewTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matched, existingForMatch]);

  async function download(row: SignoffRow) {
    try {
      const { data, error } = await supabase.storage.from("uat-signoffs").createSignedUrl(row.pdf_path, 300);
      if (error || !data) throw new Error(error?.message ?? "Could not create a download link.");
      const a = document.createElement("a");
      a.href = data.signedUrl;
      a.download = row.pdf_name;
      a.click();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function signAndConfirm() {
    if (!matched || !signaturePreview) return;
    setBusy(true);
    try {
      const res = await signFn({ data: { signerName: matched, signatureImageDataUrl: signaturePreview } });
      await qc.invalidateQueries({ queryKey: ["uat-signoffs"] });
      toast.success(`Signed by ${res.signerName} — final PDF generated`);
    } catch (err) {
      toast.error((err as Error).message);
      await qc.invalidateQueries({ queryKey: ["uat-signoffs"] });
    } finally {
      setBusy(false);
    }
  }

  function close(v: boolean) {
    if (!v) {
      setName("");
      setSignaturePreview(null);
    }
    onOpenChange(v);
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ClipboardCheck className="h-4 w-4 text-primary" /> UAT Sign-Off — {PROJECT_NAME}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
            {DOCUMENT_INTRO.map((paragraph, i) => (
              <p key={i} className={i > 0 ? "mt-2" : ""}>
                {paragraph}
              </p>
            ))}
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-foreground">
              Key functionality checklist (Step 1-2)
            </p>
            <ul className="mt-1.5 space-y-1">
              {UAT_CHECKLIST.map((item) => (
                <li key={item} className="flex items-start gap-1.5">
                  <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-success" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Every authorised signer's current status, so it's clear who else has (or hasn't) */}
          <div className="space-y-1.5">
            {AUTHORIZED_SIGNERS.map((s) => {
              const row = signoffs.find((r) => r.signer_name === s);
              return (
                <div key={s} className="flex items-center justify-between rounded-md border border-border px-3 py-1.5 text-xs">
                  <span className="flex items-center gap-1.5">
                    {row ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : <Square className="h-3.5 w-3.5 text-muted-foreground" />}
                    {s}
                  </span>
                  <span className="text-muted-foreground">
                    {row ? `Signed ${fmtDate(row.signed_at)}` : "Not yet signed"}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="border-t border-border pt-4">
            {existingForMatch ? (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-success">Document Signed Successfully</p>
                <p className="text-xs text-muted-foreground">
                  This document has been electronically signed and the final PDF has been created.
                </p>
                <div className="grid grid-cols-3 gap-2 rounded-lg border border-border p-3 text-xs">
                  <div>
                    <p className="text-muted-foreground">Signed by</p>
                    <p className="font-medium text-foreground">{existingForMatch.signer_name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Date Signed</p>
                    <p className="font-medium text-foreground">{fmtDate(existingForMatch.signed_at)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <p className="font-medium text-success">SIGNED</p>
                  </div>
                </div>
                <Button className="w-full gap-2" onClick={() => void download(existingForMatch)}>
                  <Download className="h-4 w-4" /> Download Signed PDF
                </Button>
              </div>
            ) : (
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (matched && signaturePreview && !busy) void signAndConfirm();
                }}
              >
                <p className="text-sm font-semibold">Sign Document</p>
                <p className="text-xs text-muted-foreground">
                  Please enter your full name below to sign this document. By signing, you confirm
                  that you have reviewed the document and agree to its contents.
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="uat-full-name">Full Name</Label>
                  <Input
                    id="uat-full-name"
                    placeholder="Enter your full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={busy}
                  />
                  {showValidationError && (
                    <p className="text-xs text-destructive">
                      This name is not an authorised signer for this document.
                    </p>
                  )}
                </div>

                {matched && (
                  <div className="space-y-3 rounded-lg border border-border p-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Signature Preview
                      </p>
                      <div className="mt-1 flex h-16 items-center rounded-md border border-dashed border-border bg-background px-3">
                        {signaturePreview ? (
                          <img src={signaturePreview} alt={`${matched}'s signature`} className="h-12" />
                        ) : (
                          <span style={{ fontFamily: "'Great Vibes', cursive" }} className="text-3xl text-foreground">
                            {matched}
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Date Signed
                      </p>
                      <p className="text-sm text-foreground">{fmtDate(new Date().toISOString())}</p>
                    </div>
                  </div>
                )}

                {/* The submit button is always visible so the form never looks unfinished; it stays
                 * disabled until an authorised signer name has produced a signature preview. */}
                <Button type="submit" className="w-full gap-2" disabled={busy || !matched || !signaturePreview}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Sign &amp; Confirm
                </Button>
                {!matched && (
                  <p className="text-center text-[11px] text-muted-foreground">
                    Enter an authorised signer&apos;s full name to enable signing.
                  </p>
                )}
              </form>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
