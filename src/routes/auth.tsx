import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AuthTabs } from "@/components/auth/AuthTabs";
import { useAuth } from "@/lib/auth";
import { applyCurrentStylePreset } from "@/lib/stylePreset";

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
  return "/map";
}

function AuthPage() {
  const { next } = Route.useSearch();
  const navigate = useNavigate();
  const { session, loading } = useAuth();

  useEffect(() => {
    applyCurrentStylePreset();
  }, []);

  useEffect(() => {
    if (!loading && session) navigate({ to: safeNext(next), replace: true });
  }, [loading, session, next, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-5 py-12">
      <AuthTabs next={next} defaultTab="signin" className="w-full max-w-sm rounded-2xl border border-border bg-background p-8 shadow-sm" />
    </div>
  );
}
