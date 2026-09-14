import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

type Search = { next?: string | undefined };

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    next: typeof search["next"] === "string" ? (search["next"] as string) : undefined,
  }),
  component: Landing,
});

function safeNext(next: string | undefined) {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/map";
}

/** The root route no longer renders its own marketing page — Alpha-Bravo is the site's real
 * look and feel now. Signed-in visitors go straight to the app; everyone else lands on
 * Alpha-Bravo instead of the old dark "Ink & Aqua" hero. */
function Landing() {
  const { user, loading } = useAuth();
  const { next } = Route.useSearch();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (user) {
      navigate({ to: safeNext(next), replace: true });
      return;
    }
    // Signed-out visitors land on the public home page, but an intended destination is carried
    // through so signing in returns them to the page they were trying to open.
    if (next) {
      navigate({ to: "/auth", search: { next }, replace: true });
      return;
    }
    navigate({ to: "/alpha-bravo", replace: true });
  }, [user, loading, next, navigate]);

  return null;
}
