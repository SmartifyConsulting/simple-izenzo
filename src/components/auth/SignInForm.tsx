import { useState } from "react";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/PasswordInput";
import { mapAuthError, useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

function safeNext(next: string | undefined) {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/";
}

/** The sign-in form, shared between the standalone /auth page and the home page hero. */
export function SignInForm({
  next,
  className,
  hideHeader = false,
  hideFooterLink = false,
  compact = false,
}: {
  next?: string | undefined;
  className?: string | undefined;
  hideHeader?: boolean;
  hideFooterLink?: boolean;
  /** Tighter spacing throughout — used when this form sits in a small space (the home page
   * hero) rather than the standalone /auth page. */
  compact?: boolean;
}) {
  const navigate = useNavigate();
  const router = useRouter();
  const { refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data.session) throw new Error("Your sign-in could not be saved. Please try again.");
      await refresh();
      await router.invalidate();
      await navigate({ to: safeNext(next), replace: true });
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
    await refresh();
    await router.invalidate();
    await navigate({ to: safeNext(next), replace: true });
  }

  return (
    <div className={className}>
      {!hideHeader && (
        <>
          <h2 className="text-xl font-semibold tracking-tight">Sign in</h2>
          <p className="mt-1 text-sm text-muted-foreground">Welcome back.</p>
        </>
      )}

      <form onSubmit={onSubmit} className={cn(compact ? "space-y-1.5" : "space-y-4", !hideHeader && "mt-7")}>
        <div className={compact ? "space-y-1" : "space-y-1.5"}>
          <Label htmlFor="signin-email" className={compact ? "text-xs" : undefined}>Email</Label>
          <Input
            id="signin-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            className={compact ? "h-8 text-sm" : undefined}
          />
        </div>
        <div className={compact ? "space-y-1" : "space-y-1.5"}>
          <div className="flex items-center justify-between">
            <Label htmlFor="signin-password" className={compact ? "text-xs" : undefined}>Password</Label>
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
            className={compact ? "h-8 text-sm" : undefined}
          />
        </div>

        {message && (
          <p aria-live="polite" className="text-sm text-destructive">
            {message}
          </p>
        )}

        <Button type="submit" size={compact ? "sm" : "default"} className="w-full" disabled={busy}>
          Sign in
        </Button>
      </form>

      <div className={cn("flex items-center gap-3", compact ? "my-2" : "my-5")}>
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">or</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <Button variant="outline" size={compact ? "sm" : "default"} className="w-full" onClick={google} disabled={busy}>
        Continue with Google
      </Button>

      {!compact && (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Just checking on your bids? Sign in — there's nothing to upload.
        </p>
      )}

      {!hideFooterLink && (
        <p className={cn("text-center text-sm text-muted-foreground", compact ? "mt-3" : "mt-6")}>
          No account yet?{" "}
          <Link to="/auth" search={{ mode: "signup", next }} className="font-medium text-foreground hover:underline">
            Create one
          </Link>
        </p>
      )}
    </div>
  );
}
