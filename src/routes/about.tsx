import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Us — Izenzo" },
      {
        name: "description",
        content: "Izenzo is the trading name of Starfair162 (Pty) Ltd, building governance infrastructure for institutional trade.",
      },
      { property: "og:title", content: "About Us — Izenzo" },
      {
        property: "og:description",
        content: "Governance infrastructure for institutional trade.",
      },
    ],
  }),
  component: AboutUs,
});

function AboutUs() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-5">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded bg-foreground text-[11px] font-bold text-background">
              IZ
            </span>
            <span className="text-sm font-semibold">Izenzo</span>
          </Link>
          <Link to="/auth">
            <Button size="sm" variant="outline">
              Sign in
            </Button>
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-14">
        <p className="label-caps">Company</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">About Us</h1>
        <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Izenzo is the trading name of Starfair162 (Pty) Ltd, Reg: 2018 / 331720 / 07. We build the
          Izenzo Trading Gateway: governance infrastructure that carries a trade from first bid to
          sealed memory, one written record at a time.
        </p>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Every step — trading, compliance, execution, finality and memory — is attributed to a
          person, timestamped and fingerprinted. Intent is sealed before anything moves, and AI
          proposes but never decides. We think trade should be provable, not just recorded.
        </p>
      </main>
    </div>
  );
}
