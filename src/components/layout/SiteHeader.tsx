import { useEffect } from "react";
import { MainHeader } from "@/components/layout/MainHeader";
import { applyAppSkin } from "@/lib/appSkin";

/** Kept as a thin wrapper so the older content pages (Pricing, Glossary, Contact, Privacy,
 * Terms, Status, product and solution pages) render the exact same menu as every other screen. */
export function SiteHeader(_props: { logoClassName?: string | undefined; containerClassName?: string | undefined } = {}) {
  useEffect(() => {
    applyAppSkin("izenzo");
  }, []);

  return <MainHeader />;
}
