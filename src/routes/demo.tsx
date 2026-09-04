import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: "Request a Demo — Izenzo" },
      {
        name: "description",
        content: "See the Izenzo Trading Gateway on a live transaction, walked through by our team.",
      },
      { property: "og:title", content: "Request a Demo — Izenzo" },
      {
        property: "og:description",
        content: "See the Izenzo Trading Gateway on a live transaction.",
      },
    ],
  }),
  component: RequestDemo,
});

function RequestDemo() {
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
        <p className="label-caps">Demo</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Request a demo</h1>
        <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Tell us a little about your organisation and we'll walk you through a live transaction on
          the Izenzo Trading Gateway — Trading, Compliance, Execution, Finality and Memory, gate by
          gate.
        </p>
        <div className="mt-8">
          <a href="mailto:support@izenzo.co.za?subject=Demo%20request">
            <Button size="lg">Email support@izenzo.co.za</Button>
          </a>
        </div>
      </main>
    </div>
  );
}
