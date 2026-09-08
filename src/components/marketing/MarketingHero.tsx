import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type Cta =
  | { label: string; to: string; kind?: "internal" }
  | { label: string; href: string; kind: "external" };

export function MarketingHero({
  eyebrow,
  headline,
  subtext,
  primaryCta,
  secondaryCta,
  statLine,
  visual,
}: {
  eyebrow: string;
  headline: ReactNode;
  subtext: string;
  primaryCta: Cta;
  secondaryCta: Cta;
  statLine: string;
  visual?: ReactNode;
}) {
  return (
    <section className="border-b border-border bg-gradient-to-b from-primary/5 via-background to-background">
      <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 lg:grid-cols-2 lg:items-center">
        <div>
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            {eyebrow}
          </span>
          <h1 className="mt-4 text-4xl font-semibold leading-[1.08] tracking-tight text-foreground sm:text-5xl">
            {headline}
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-muted-foreground">{subtext}</p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <CtaButton cta={primaryCta} primary />
            <CtaButton cta={secondaryCta} />
          </div>
          <p className="mt-10 text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
            {statLine}
          </p>
        </div>
        {visual && <div className="relative">{visual}</div>}
      </div>
    </section>
  );
}

function CtaButton({ cta, primary }: { cta: Cta; primary?: boolean }) {
  const content = (
    <>
      {cta.label} <ArrowRight className="h-4 w-4" />
    </>
  );
  if (cta.kind === "external") {
    return (
      <a href={cta.href}>
        <Button
          size="lg"
          variant={primary ? "default" : "ghost"}
          className={primary ? "gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90" : "gap-1.5 text-foreground"}
        >
          {cta.label} <ChevronRight className="h-4 w-4" />
        </Button>
      </a>
    );
  }
  return (
    <Link to={cta.to}>
      <Button
        size={primary ? "lg" : "default"}
        variant={primary ? "default" : "ghost"}
        className={primary ? "gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90" : "gap-1.5 text-foreground"}
      >
        {content}
      </Button>
    </Link>
  );
}
