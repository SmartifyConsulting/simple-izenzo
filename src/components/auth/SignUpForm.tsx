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

/** The account-creation form, shared between the standalone /auth page and the home page hero. */
export function SignUpForm({
  next,
  className,
}: {
  next?: string | undefined;
  className?: string | undefined;
}) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const rules = [
    { ok: password.length >= 8, label: "At least 8 characters" },
    { ok: /[A-Za-z]/.test(password) && /\d/.test(password), label: "A letter and a number" },
    {
      ok: password.length > 0 && password.toLowerCase() !== email.split("@")[0]?.toLowerCase(),
      label: "Not your email name",
    },
  ];

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    if (rules.some((r) => !r.ok)) {
      setMessage("Please meet all the password requirements.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}${safeNext(next)}`,
          data: { full_name: fullName },
        },
      });
      if (error) throw error;
      toast.success("Account created");
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
      <h2 className="text-xl font-semibold tracking-tight">Create your account</h2>
      <p className="mt-1 text-sm text-muted-foreground">Open a seat on the Izenzo Trading Gateway.</p>

      <form onSubmit={onSubmit} className="mt-7 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="hero-name">Full name</Label>
          <Input
            id="hero-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoComplete="name"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hero-email">Email</Label>
          <Input
            id="hero-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hero-password">Password</Label>
          <PasswordInput
            id="hero-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
          <ul className="mt-2 space-y-1">
            {rules.map((r) => (
              <li key={r.label} className={"text-xs " + (r.ok ? "text-success" : "text-muted-foreground")}>
                {r.ok ? "✓" : "•"} {r.label}
              </li>
            ))}
          </ul>
        </div>

        {message && (
          <p aria-live="polite" className="text-sm text-destructive">
            {message}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={busy}>
          Create account
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

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link to="/auth" search={{ mode: "signin", next }} className="font-medium text-foreground hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
