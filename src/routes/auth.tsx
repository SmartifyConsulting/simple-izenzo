import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AuthTabs } from "@/components/auth/AuthTabs";
import { useAuth } from "@/lib/auth";
import { applyCurrentStylePreset } from "@/lib/stylePreset";
import { registrationInProgress } from "@/lib/registrationFlow";

type Search = {
  mode?: "signin" | "signup" | undefined;
  next?: string | undefined;
  expired?: boolean | undefined;
};

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    mode: search["mode"] === "signup" ? "signup" : "signin",
    next: typeof search["next"] === "string" ? (search["next"] as string) : undefined,
    expired: search["expired"] === true || search["expired"] === "true" ? true : undefined,
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
  return "/";
}

function AuthPage() {
  const { next, expired } = Route.useSearch();
  const navigate = useNavigate();
  const { session, loading } = useAuth();

  useEffect(() => {
    applyCurrentStylePreset();
  }, []);

  useEffect(() => {
    if (!loading && session) {
      // A sign-up in progress is signed in by definition, but must not be bounced off step 3 —
      // the form has to stay mounted until the ID number and document are captured.
      if (registrationInProgress()) return;
      navigate({ to: safeNext(next), replace: true });
    }
  }, [loading, session, next, navigate]);

  // A counterparty following the "View this opportunity" link from an email lands here first
  // (the _authenticated layout sends anyone signed out through here and back) — say what signing
  // in or creating an account is actually for, rather than a generic sign-in screen with no context.
  const forOpportunity = Boolean(next && next.startsWith("/counterparty/claim"));

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-muted/40 px-5 py-12">
      {forOpportunity && (
        <p className="w-full max-w-sm rounded-xl border border-border bg-background px-4 py-3 text-center text-sm font-medium">
          To view your opportunity, sign in or sign up.
        </p>
      )}
      {expired && (
        <p className="w-full max-w-sm rounded-xl border border-border bg-background px-4 py-3 text-xs text-muted-foreground">
          Your session expired — please sign in again to continue.
        </p>
      )}
      <AuthTabs
        next={next}
        defaultTab="signin"
        className="w-full max-w-sm rounded-2xl border border-border bg-background p-8 shadow-sm"
      />
    </div>
  );
}
