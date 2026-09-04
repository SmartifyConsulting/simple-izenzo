import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/PasswordInput";
import { mapAuthError } from "@/lib/auth";

function safeNext(next: string | undefined) {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/dashboard";
}

/** The sign-in form, shared between the standalone /auth page and the home page hero. */
export function SignInForm({
  next,
  className,
  hideHeader = false,
  hideFooterLink = false,
}: {
  next?: string | undefined;
  className?: string | undefined;
  hideHeader?: boolean;
  hideFooterLink?: boolean;
}) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate({ to: safeNext(next), replace: true });
    } catch (err) {
      const msg = mapAuthError((err as Error).message);
      setMessage(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setBusy(false);
      toast.error(mapAuthError(String(result.error)));
      return;
    }
    if (result.redirected) return;
    navigate({ to: safeNext(next), replace: true });
  }

  return (
    <div className={className}>
      {!hideHeader && (
        <>
          <h2 className="text-xl font-semibold tracking-tight">Sign in</h2>
          <p className="mt-1 text-sm text-muted-foreground">Welcome back.</p>
        </>
      )}

      <form onSubmit={onSubmit} className={hideHeader ? "space-y-4" : "mt-7 space-y-4"}>
        <div className="space-y-1.5">
          <Label htmlFor="signin-email">Email</Label>
          <Input
            id="signin-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="signin-password">Password</Label>
            <Link to="/forgot-password" tabIndex={-1} className="text-xs text-muted-foreground hover:text-foreground">
              Forgot password?
            </Link>
          </div>
          <PasswordInput
            id="signin-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        {message && (
          <p aria-live="polite" className="text-sm text-destructive">
            {message}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={busy}>
          Sign in
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">or</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <Button variant="outline" className="w-full" onClick={google} disabled={busy}>
        Continue with Google
      </Button>

      {!hideFooterLink && (
        <p className="mt-6 text-center text-sm text-muted-foreground">
          No account yet?{" "}
          <Link to="/auth" search={{ mode: "signup", next }} className="font-medium text-foreground hover:underline">
            Create one
          </Link>
        </p>
      )}
    </div>
  );
}
