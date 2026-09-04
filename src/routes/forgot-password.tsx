import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { mapAuthError } from "@/lib/auth";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset your password — Izenzo" },
      { name: "description", content: "Request a link to set a new Izenzo password." },
      { property: "og:title", content: "Reset your password — Izenzo" },
      { property: "og:description", content: "Request a link to set a new Izenzo password." },
    ],
  }),
  component: ForgotPassword,
});

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) {
      const msg = mapAuthError(error.message);
      setMessage(msg);
      toast.error(msg);
      return;
    }
    setSent(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm">
        <Link to="/">
          <Logo />
        </Link>
        <h1 className="mt-8 text-xl font-semibold tracking-tight">Forgot your password?</h1>
        {sent ? (
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            If an account exists for {email}, a link to set a new password is on its way. The link
            opens the page where you choose the new password.
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              Enter your email and we'll send you a link to set a new one.
            </p>
            <form onSubmit={onSubmit} className="mt-7 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
              {message && (
                <p aria-live="polite" className="text-sm text-destructive">
                  {message}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={busy}>
                Send reset link
              </Button>
            </form>
          </>
        )}
        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link to="/" className="font-medium text-foreground hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
