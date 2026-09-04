import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck, FileLock2, GitBranch, Landmark, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SPINE } from "@/lib/spine";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Izenzo — Proof-backed trading, from intent to memory" },
      {
        name: "description",
        content:
          "Izenzo is a trading platform where every step is recorded: trading, compliance, execution, finality and memory. Intent is sealed, not assumed.",
      },
      { property: "og:title", content: "Izenzo — Proof-backed trading" },
      {
        property: "og:description",
        content:
          "A trading spine that records every step: trading, compliance and governance, execution, finality and memory.",
      },
    ],
  }),
  component: Landing,
});

const STAGE_ICONS = [GitBranch, ShieldCheck, Landmark, FileLock2, History];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded bg-foreground text-[11px] font-bold text-background">
              IZ
            </span>
            <span className="text-sm font-semibold tracking-tight">Izenzo</span>
          </Link>
          <nav className="flex items-center gap-1">
            <Link to="/glossary">
              <Button variant="ghost" size="sm">
                Glossary
              </Button>
            </Link>
            <Link to="/auth">
              <Button variant="ghost" size="sm">
                Sign in
              </Button>
            </Link>
            <Link to="/auth" search={{ mode: "signup" }}>
              <Button size="sm">Create account</Button>
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-5 py-20">
          <p className="label-caps">Trading · Compliance · Execution · Finality · Memory</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
            A transaction is not a conversation. It is a record.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Izenzo carries a trade along a single spine. Every step is written once, attributed to a
            person, timestamped and fingerprinted. Intent is sealed before anything moves, and the
            record can be read forward and backward for as long as it matters.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/auth" search={{ mode: "signup" }}>
              <Button size="lg" className="gap-2">
                Open a seat <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/glossary">
              <Button size="lg" variant="outline">
                Read the terms
              </Button>
            </Link>
          </div>
        </section>

        <section className="border-y border-border bg-muted/40">
          <div className="mx-auto max-w-6xl px-5 py-14">
            <h2 className="text-lg font-semibold tracking-tight">The spine</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Five stages. Nothing skips ahead of its gate.
            </p>
            <div className="mt-8 grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2 lg:grid-cols-5">
              {SPINE.map((stage, i) => {
                const Icon = STAGE_ICONS[i] ?? GitBranch;
                return (
                  <div key={stage.key} className="bg-background p-5">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <h3 className="mt-3 text-sm font-semibold">{stage.label}</h3>
                    <ul className="mt-3 space-y-1.5">
                      {stage.steps.map((s) => (
                        <li key={s.key} className="text-xs text-muted-foreground">
                          {s.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-16">
          <div className="grid gap-8 md:grid-cols-3">
            <div>
              <h3 className="text-sm font-semibold">Proof of Intent is a gate</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Nothing past Trading opens until a person confirms intent and the Proof of Intent is
                sealed. One token, USD 10, charged on the server, not hidden in the interface.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold">WaD before execution</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Who and Domicile — KYC, KYB, UBO, sanctions and PEP — must clear before execution can
                begin. Three further tokens, USD 30.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold">AI proposes, people decide</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                AI and AI+ read the record and put forward proposals. They are stored as proposals.
                A person adopts them, and that adoption is itself an event.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-8 text-xs text-muted-foreground">
          <span>Izenzo</span>
          <div className="flex gap-4">
            <Link to="/glossary" className="hover:text-foreground">
              Glossary
            </Link>
            <Link to="/auth" className="hover:text-foreground">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
