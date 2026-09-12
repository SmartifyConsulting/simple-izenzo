import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ScanFace } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { startFaceSignIn, pollFaceSignIn } from "@/lib/faceAuth.functions";

/** Face sign-in. Nothing to upload and no search to run — type your email, pass the face check in
 * the window that opens, and you land straight on your workspace to see how your bids are doing. */
export function FaceSignIn({ next, onDone }: { next?: string | undefined; onDone?: () => void }) {
  const navigate = useNavigate();
  const start = useServerFn(startFaceSignIn);
  const poll = useServerFn(pollFaceSignIn);

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [message, setMessage] = useState("");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  function safeNext() {
    if (next && next.startsWith("/") && !next.startsWith("//")) return next;
    return "/live-deal-engine";
  }

  async function begin(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    setBusy(true);
    try {
      const { attemptId, url } = await start({ data: { email, origin: window.location.origin } });
      window.open(url, "izenzo-face-check", "width=520,height=760,noopener,noreferrer");
      setWaiting(true);
      setMessage("Complete the face check in the window that just opened. We'll sign you in automatically.");
      timer.current = setInterval(async () => {
        try {
          const result = await poll({ data: { attemptId } });
          if (result.state === "waiting") return;
          if (timer.current) clearInterval(timer.current);
          if (result.state === "failed") {
            setWaiting(false);
            setMessage(result.reason);
            return;
          }
          const { error } = await supabase.auth.verifyOtp({ type: "email", token_hash: result.tokenHash });
          if (error) throw error;
          onDone?.();
          navigate({ to: safeNext(), replace: true });
        } catch (err) {
          if (timer.current) clearInterval(timer.current);
          setWaiting(false);
          setMessage((err as Error).message);
        }
      }, 3000);
    } catch (err) {
      const msg = (err as Error).message;
      setMessage(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button variant="outline" className="mt-3 w-full" onClick={() => setOpen(true)}>
        <ScanFace className="mr-2 h-4 w-4" aria-hidden="true" />
        Sign in with facial recognition
      </Button>
    );
  }

  return (
    <form onSubmit={begin} className="mt-3 space-y-3 rounded-xl border border-border p-4">
      <div className="space-y-1.5">
        <Label htmlFor="face-email">Email</Label>
        <Input
          id="face-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
      </div>
      {message && (
        <p aria-live="polite" className="text-sm text-muted-foreground">
          {message}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={busy || waiting}>
        {waiting ? "Waiting for your face check…" : busy ? "Opening…" : "Start face check"}
      </Button>
    </form>
  );
}
