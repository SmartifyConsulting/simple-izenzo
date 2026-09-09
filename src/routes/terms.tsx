import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms and Conditions — Izenzo" },
      { name: "description", content: "The terms that govern use of the Izenzo Trading Gateway." },
    ],
  }),
  component: Terms,
});

function Terms() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-5 py-16">
        <p className="label-caps">Legal</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Terms and Conditions</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: 2026</p>

        <div className="mt-10 space-y-8 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-base font-semibold text-foreground">The service</h2>
            <p className="mt-2">
              Izenzo, operated by Starfair162 (Pty) Ltd (Reg: 2018/331720/07), provides the
              Trading Gateway: a structured, hash-sealed record of a transaction from bid/offer
              through Proof of Intent, Without a Doubt compliance, execution and finality.
            </p>
          </section>
          <section>
            <h2 className="text-base font-semibold text-foreground">Your account</h2>
            <p className="mt-2">
              You're responsible for the accuracy of what you record on the platform and for
              keeping your sign-in credentials secure. Tokens spent sealing a gate (Proof of
              Intent, WaD) are non-refundable once the gate is sealed.
            </p>
          </section>
          <section>
            <h2 className="text-base font-semibold text-foreground">No investment advice</h2>
            <p className="mt-2">
              Izenzo records and structures transactions; it does not provide investment,
              financial or legal advice, and AI proposals surfaced on the platform are never
              adopted automatically — a person makes every decision.
            </p>
          </section>
          <section>
            <h2 className="text-base font-semibold text-foreground">Contact</h2>
            <p className="mt-2">
              Questions about these terms can be sent to{" "}
              <a href="mailto:support@izenzo.co.za" className="text-primary hover:underline">
                support@izenzo.co.za
              </a>
              .
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
