import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput, toInternational } from "@/components/auth/PhoneInput";
import { useAuth } from "@/lib/auth";
import { confirmLinkPhone, sendLinkPhoneOtp } from "@/lib/phoneAuth.functions";

/** Existing email accounts must add and confirm a mobile number once before carrying on. */
export function AddPhoneDialog({ open }: { open: boolean }) {
  const { refresh, signOut } = useAuth();
  const navigate = useNavigate();
  const sendFn = useServerFn(sendLinkPhoneOtp);
  const confirmFn = useServerFn(confirmLinkPhone);
  const [dial, setDial] = useState("27");
  const [local, setLocal] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const phone = toInternational(dial, local);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      if (!sent) {
        await sendFn({ data: { phone } });
        setSent(true);
        toast.success("SMS code sent");
      } else {
        await confirmFn({ data: { phone, code } });
        toast.success("Mobile number confirmed");
        await refresh();
      }
    } catch (err) {
      const msg = (err as Error).message;
      setMessage(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open}>
      <DialogContent
        className="[&>button]:hidden"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Add your mobile number</DialogTitle>
          <DialogDescription>
            Izenzo now signs people in with their mobile number. Confirm yours once with an SMS code —
            you can still use your email to sign in afterwards.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="add-phone">Mobile number</Label>
            <PhoneInput id="add-phone" dial={dial} onDialChange={setDial} value={local} onChange={setLocal} disabled={sent} />
          </div>
          {sent && (
            <div className="space-y-1.5">
              <Label htmlFor="add-phone-code">SMS code</Label>
              <Input
                id="add-phone-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                required
              />
            </div>
          )}
          {message && (
            <p aria-live="polite" className="text-sm text-destructive">
              {message}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={busy}>
            {sent ? "Confirm number" : "Send SMS code"}
          </Button>
          {sent && (
            <button
              type="button"
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
              onClick={() => {
                setSent(false);
                setCode("");
              }}
            >
              Change number
            </button>
          )}
        </form>
        <button
          type="button"
          onClick={() => void signOut().then(() => navigate({ to: "/", replace: true }))}
          className="text-center text-xs text-muted-foreground hover:text-foreground"
        >
          Sign out
        </button>
      </DialogContent>
    </Dialog>
  );
}
