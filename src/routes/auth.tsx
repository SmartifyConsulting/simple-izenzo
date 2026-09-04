import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/PasswordInput";
import { mapAuthError, useAuth } from "@/lib/auth";

type Search = { mode?: "signin" | "signup" | undefined; next?: string | undefined };

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    mode: search["mode"] === "signup" ? "signup" : "signin",
    next: typeof search["next"] === "string" ? (search["next"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign in — Izenzo" },
      { name: "description", content: "Sign in to your Izenzo seat or create an account." },
      { property: "og:title", content: "Sign in — Izenzo" },
      { property: "og:description", content: "Sign in to your Izenzo seat or create an account." },
    ],
  }),
  component: AuthPage,
});

function safeNext(next: string | undefined) {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/dashboard";
}

function AuthPage() {
  const { mode, next } = Route.useSearch();
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const signup = mode === "signup";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!loading && session) navigate({ to: safeNext(next), replace: true });
  }, [loading, session, next, navigate]);

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
    if (signup && rules.some((r) => !r.ok)) {
      setMessage("Please meet all the password requirements.");
      return;
    }
    setBusy(true);
    try {
      if (signup) {
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
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: safeNext(next), replace: true });
      }
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
    <div className="flex min-h-screen">
      <div className="hidden flex-1 flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded bg-sidebar-primary text-[11px] font-bold text-sidebar-primary-foreground">
            IZ
          </span>
          <span className="text-sm font-semibold">Izenzo</span>
        </Link>
        <div className="max-w-sm">
          <p className="text-xl font-medium leading-snug text-sidebar-primary">
            Intent is sealed before anything moves.
          </p>
          <p className="mt-3 text-sm leading-relaxed opacity-70">
            Trading, compliance and governance, execution, finality, memory. One set of Trade Gates, one record.
          </p>
        </div>
        <p className="text-xs opacity-50">Izenzo</p>
      </div>

      <div className="flex flex-1 items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">
          <h1 className="text-xl font-semibold tracking-tight">
            {signup ? "Create your account" : "Sign in"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {signup ? "Open a seat on the Izenzo Trade Gates." : "Welcome back."}
          </p>

          <form onSubmit={onSubmit} className="mt-7 space-y-4">
            {signup && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Full name</Label>
                <Input
                  id="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                  required
                />
              </div>
            )}
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
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                {!signup && (
                  <Link
                    to="/forgot-password"
                    tabIndex={-1}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Forgot password?
                  </Link>
                )}
              </div>
              <PasswordInput
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={signup ? "new-password" : "current-password"}
                required
              />
              {signup && (
                <ul className="mt-2 space-y-1">
                  {rules.map((r) => (
                    <li
                      key={r.label}
                      className={
                        "text-xs " + (r.ok ? "text-success" : "text-muted-foreground")
                      }
                    >
                      {r.ok ? "✓" : "•"} {r.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {message && (
              <p aria-live="polite" className="text-sm text-destructive">
                {message}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={busy}>
              {signup ? "Create account" : "Sign in"}
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
            {signup ? "Already have an account? " : "No account yet? "}
            <Link
              to="/auth"
              search={{ mode: signup ? "signin" : "signup", next }}
              className="font-medium text-foreground hover:underline"
            >
              {signup ? "Sign in" : "Create one"}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
