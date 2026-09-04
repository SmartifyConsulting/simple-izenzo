import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AuthTabs } from "@/components/auth/AuthTabs";
import { useAuth } from "@/lib/auth";

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

  useEffect(() => {
    if (!loading && session) navigate({ to: safeNext(next), replace: true });
  }, [loading, session, next, navigate]);

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
            Trading, compliance and governance, execution, finality, memory. One Trading Gateway, one record.
          </p>
        </div>
        <p className="text-xs opacity-50">Izenzo</p>
      </div>

      <div className="flex flex-1 items-center justify-center px-5 py-12">
        <AuthTabs next={next} defaultTab={mode} className="w-full max-w-sm" />
      </div>
    </div>
  );
}
