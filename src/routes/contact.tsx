import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact Us — Izenzo" },
      { name: "description", content: "Get in touch with the Izenzo team." },
      { property: "og:title", content: "Contact Us — Izenzo" },
      { property: "og:description", content: "Get in touch with the Izenzo team." },
    ],
  }),
  component: ContactUs,
});

function ContactUs() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-5 py-14">
        <p className="label-caps">Get in touch</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Contact Us</h1>
        <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Questions about your seat, a transaction, or the Izenzo Trading Gateway itself — reach us directly.
        </p>
        <dl className="mt-8 space-y-4 text-sm">
          <div>
            <dt className="font-semibold">Support</dt>
            <dd className="mt-1 text-muted-foreground">
              <a href="mailto:support@izenzo.co.za" className="hover:text-foreground">
                support@izenzo.co.za
              </a>
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Registered entity</dt>
            <dd className="mt-1 text-muted-foreground">
              Izenzo is the trading name of Starfair162 (Pty) Ltd, Reg: 2018 / 331720 / 07
            </dd>
          </div>
        </dl>
      </main>
      <SiteFooter />
    </div>
  );
}
