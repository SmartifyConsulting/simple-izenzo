import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/PasswordInput";
import { PhoneInput, toInternational } from "@/components/auth/PhoneInput";
import { mapAuthError } from "@/lib/auth";
import { phoneSignIn, resetPasswordWithOtp, sendPhoneOtp } from "@/lib/phoneAuth.functions";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset your password — Izenzo" },
      { name: "description", content: "Get an SMS code or email link to set a new Izenzo password." },
      { property: "og:title", content: "Reset your password — Izenzo" },
      { property: "og:description", content: "Get an SMS code or email link to set a new Izenzo password." },
    ],
  }),
  component: ForgotPassword,
});

function ForgotPassword() {
  const navigate = useNavigate();
  const [method, setMethod] = useState<"phone" | "email">("phone");
  const [email, setEmail] = useState("");
  const [dial, setDial] = useState("27");
  const [phoneLocal, setPhoneLocal] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const sendOtp = useServerFn(sendPhoneOtp);
  const resetFn = useServerFn(resetPasswordWithOtp);
  const signInFn = useServerFn(phoneSignIn);

  const phone = toInternational(dial, phoneLocal);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      if (method === "email") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setSent(true);
      } else if (!sent) {
        await sendOtp({ data: { phone, purpose: "reset" } });
        setSent(true);
      } else {
        if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
          throw new Error("Use at least 8 characters with a letter and a number.");
        }
        await resetFn({ data: { phone, code, password } });
        const tokens = await signInFn({ data: { phone, password } });
        await supabase.auth.setSession(tokens);
        toast.success("Password updated");
        navigate({ to: "/", replace: true });
      }
    } catch (err) {
      const msg = mapAuthError((err as Error).message);
      setMessage(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm">
        <Link to="/">
          <Logo />
        </Link>
        <h1 className="mt-8 text-xl font-semibold tracking-tight">Forgot your password?</h1>
        {sent && method === "email" ? (
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            If an account exists for {email}, a link to set a new password is on its way.
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              {method === "phone"
                ? sent
                  ? `If +${phone} has an account, we've sent it a 6-digit code. Enter it and choose a new password.`
                  : "Enter your mobile number and we'll SMS you a code."
                : "Enter your email and we'll send you a link to set a new one."}
            </p>
            <form onSubmit={onSubmit} className="mt-7 space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="fp-id">{method === "phone" ? "Mobile number" : "Email"}</Label>
                  <button
                    type="button"
                    tabIndex={-1}
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setMethod((m) => (m === "phone" ? "email" : "phone"));
                      setSent(false);
                    }}
                  >
                    {method === "phone" ? "Use email instead" : "Use phone instead"}
                  </button>
                </div>
                {method === "phone" ? (
                  <PhoneInput
                    id="fp-id"
                    dial={dial}
                    onDialChange={setDial}
                    value={phoneLocal}
                    onChange={setPhoneLocal}
                    disabled={sent}
                  />
                ) : (
                  <Input id="fp-id" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                )}
              </div>
              {method === "phone" && sent && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="fp-code">SMS code</Label>
                    <Input
                      id="fp-code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="fp-pw">New password</Label>
                    <PasswordInput
                      id="fp-pw"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                      required
                    />
                  </div>
                </>
              )}
              {message && (
                <p aria-live="polite" className="text-sm text-destructive">
                  {message}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={busy}>
                {method === "email" ? "Send reset link" : sent ? "Set new password" : "Send SMS code"}
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
