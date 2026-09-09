import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Izenzo" },
      { name: "description", content: "How Izenzo collects, uses and protects your data." },
    ],
  }),
  component: Privacy,
});

function Privacy() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-5 py-16">
        <p className="label-caps">Legal</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: 2026</p>

        <div className="mt-10 space-y-8 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-base font-semibold text-foreground">What we collect</h2>
            <p className="mt-2">
              Account details you provide (name, email, organisation), transaction and
              compliance records created on the Trading Gateway, and technical data needed to
              operate the service securely.
            </p>
          </section>
          <section>
            <h2 className="text-base font-semibold text-foreground">How we use it</h2>
            <p className="mt-2">
              To operate your account, record transactions on the Trading Gateway, meet our
              regulatory obligations (KYC/KYB, sanctions screening), and communicate with you
              about your account and trades.
            </p>
          </section>
          <section>
            <h2 className="text-base font-semibold text-foreground">Retention</h2>
            <p className="mt-2">
              Trade and compliance records are retained for the regulatory window required of a
              trading platform. Personal profile details can be deleted from Settings, subject to
              the retention obligations above.
            </p>
          </section>
          <section>
            <h2 className="text-base font-semibold text-foreground">Contact</h2>
            <p className="mt-2">
              Questions about this policy or a data request can be sent to{" "}
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
