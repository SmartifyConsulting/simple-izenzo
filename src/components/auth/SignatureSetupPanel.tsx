import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SIGNATURE_FONTS } from "@/lib/signatureFonts";

/** Step 3 of sign-up: pick a cursive font for your digital signature, previewed against your own
 * name, before moving on to the ID/Authority document step. Saved once, on Continue — reachable
 * again later from account settings if someone wants to change it. */
export function SignatureSetupPanel({
  fullName,
  onSaved,
}: {
  fullName: string;
  onSaved: () => void;
}) {
  const [fontId, setFontId] = useState(SIGNATURE_FONTS[0]!.id);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Please open the confirmation link in your email first.");
      const { error } = await supabase.from("profiles").update({ signature_font: fontId } as never).eq("id", userId);
      if (error) throw error;
      onSaved();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const previewName = fullName.trim() || "Your Name";

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Set up your digital signature</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a font for your signature — it's what appears on Legal Agreements once both parties
          sign.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-muted/20 p-6 text-center">
        <p className="text-3xl" style={{ fontFamily: SIGNATURE_FONTS.find((f) => f.id === fontId)!.family }}>
          {previewName}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {SIGNATURE_FONTS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFontId(f.id)}
            aria-pressed={fontId === f.id}
            className={cn(
              "rounded-md border px-3 py-2.5 text-center text-lg transition-colors",
              fontId === f.id
                ? "border-primary bg-primary/10 text-foreground"
                : "border-input text-muted-foreground hover:bg-accent",
            )}
            style={{ fontFamily: f.family }}
          >
            {previewName}
          </button>
        ))}
      </div>

      <Button className="w-full" disabled={busy} onClick={() => void save()}>
        {busy ? "Saving…" : "Continue"}
      </Button>
    </div>
  );
}
