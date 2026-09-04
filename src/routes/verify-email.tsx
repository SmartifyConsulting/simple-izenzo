import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { mapAuthError, useAuth } from "@/lib/auth";

type Search = { verified?: boolean };

export const Route = createFileRoute("/verify-email")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): Search => ({
    verified: search["verified"] === "1" || search["verified"] === true,
  }),
  head: () => ({
    meta: [
      { title: "Confirm your email — Izenzo" },
      {
        name: "description",
        content: "Confirm your email address once to keep using your Izenzo seat.",
      },
      { property: "og:title", content: "Confirm your email — Izenzo" },
      {
        property: "og:description",
        content: "Confirm your email address once to keep using your Izenzo seat.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  const { verified } = Route.useSearch();
  const navigate = useNavigate();
  const { user, refresh, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!verified || !user) return;
    void (async () => {
      const { error } = await supabase.rpc("mark_email_verified");
      if (error) {
        setMessage(mapAuthError(error.message));
        return;
      }
      await refresh();
      setDone(true);
      toast.success("Email confirmed");
      setTimeout(() => navigate({ to: "/dashboard", replace: true }), 900);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verified, user?.id]);

  async function send() {
    if (!user?.email) return;
    setBusy(true);
    setMessage("");
    const { error } = await supabase.auth.signInWithOtp({
      email: user.email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/verify-email?verified=1`,
      },
    });
    setBusy(false);
    if (error) {
      const msg = mapAuthError(error.message);
      setMessage(msg);
      toast.error(msg);
      return;
    }
    setSent(true);
    toast.success("Confirmation link sent");
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-semibold tracking-tight">
          {done ? "Email confirmed" : "Confirm your email"}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {done
            ? "Thanks — taking you to your dashboard."
            : `We need to confirm ${user?.email ?? "your email address"} once. Send yourself a link and open it on this device.`}
        </p>

        {!done && (
          <>
            <Button className="mt-6 w-full" onClick={send} disabled={busy}>
              {sent ? "Send another link" : "Send confirmation link"}
            </Button>
            {sent && (
              <p aria-live="polite" className="mt-3 text-sm text-muted-foreground">
                Link sent. It opens this page and confirms you automatically.
              </p>
            )}
            {message && (
              <p aria-live="polite" className="mt-3 text-sm text-destructive">
                {message}
              </p>
            )}
            <button
              type="button"
              onClick={() => void signOut().then(() => navigate({ to: "/", replace: true }))}
              className="mt-6 w-full text-center text-xs text-muted-foreground hover:text-foreground"
            >
              Sign out
            </button>
          </>
        )}
      </div>
    </div>
  );
}
