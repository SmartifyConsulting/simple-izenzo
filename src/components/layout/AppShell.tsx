import { useEffect, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

import { MainHeader } from "@/components/layout/MainHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";

import { applyCurrentStylePreset } from "@/lib/stylePreset";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** Classic is the app's one committed view — no layout or view selector, just this shell. */
export function AppShell({
  title,
  description,
  actions,
  children,
  wide,
  pureBlack,
  compactFooter,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  wide?: boolean;
  /** Forces the page background to literal black instead of the theme's near-black
   * `--background`, for screens meant to sit flush with the header/nav's own black chrome. */
  pureBlack?: boolean;
  /** Shows the shorter (30% reduced height) footer — used on the Live Workspace, where vertical
   * space is at a premium. */
  compactFooter?: boolean;
}) {
  const { profile } = useAuth();
  const firstName = (profile?.full_name ?? profile?.email ?? "").split(/[\s@]/)[0];

  // Keeps `profiles.last_accessed_at` fresh while this person actually has the app open, so the
  // green/amber/red presence dot elsewhere in the app reflects real activity rather than just the
  // moment they last signed in.
  useEffect(() => {
    if (!profile?.id) return;
    const beat = () => {
      if (document.visibilityState !== "visible") return;
      void supabase.from("profiles").update({ last_accessed_at: new Date().toISOString() }).eq("id", profile.id);
    };
    beat();
    const interval = setInterval(beat, 60_000);
    document.addEventListener("visibilitychange", beat);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", beat);
    };
  }, [profile?.id]);
  const width = wide ? "max-w-[1680px]" : "max-w-7xl";
  const pathname = useRouterState({ select: (s) => s.location.pathname });


  // Document-style screens (settings, admin, reporting, API docs) drop the canvas grid and give
  // every frame the same green edge — the grid belongs to the deal canvas, not to tables and forms.
  const flat = ["/account", "/admin", "/credits", "/trades", "/activity", "/developer", "/docs"].some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  useEffect(() => {
    applyCurrentStylePreset();
  }, []);

  return (
    <div
      className={cn(
        "flex min-h-screen flex-col overflow-x-hidden",
        flat ? "flat-frames" : "ink-grid",
        pureBlack ? "" : "bg-background",
      )}
      style={pureBlack ? { backgroundColor: "#000" } : undefined}
    >
      {/* Same menu as every other screen in the app. */}
      <MainHeader />

      <main
        className={cn(
          "mx-auto w-full flex-1 px-4 sm:px-6",
          width,
          wide ? "pt-3" : "pt-5",
          // Bottom padding clears the now fixed-to-viewport footer so content never renders
          // underneath it.
          compactFooter ? "pb-16" : "pb-24",
        )}
      >
        <div
          className={cn(
            "grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4",
            wide ? "mb-2" : "mb-4",
          )}
        >
          <div className="min-w-0">
            {firstName && (
              <p
                className={cn(
                  "truncate leading-[1.15] tracking-tight",
                  wide
                    ? "text-[1.15rem] sm:text-[1.3rem]"
                    : "text-[1.75rem] sm:text-[2rem]",
                )}
                style={{ fontFamily: "var(--font-greeting)", fontWeight: 700 }}
              >
                {greeting()}, {firstName}
              </p>
            )}
            {title && (
              <h1 className="mt-2 truncate text-sm font-semibold tracking-tight text-muted-foreground">
                {title}
              </h1>
            )}
            {description && (
              <p className="mt-1 truncate text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          {actions && <div>{actions}</div>}
        </div>
        {children}
      </main>

      <SiteFooter compact={compactFooter} />
    </div>
  );

}
