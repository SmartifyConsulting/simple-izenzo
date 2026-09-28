import { useEffect } from "react";
import { MainHeader } from "@/components/layout/MainHeader";
import { applyCurrentStylePreset } from "@/lib/stylePreset";

/** Kept as a thin wrapper so the older content pages render the exact same menu as every other
 * screen. Applies the user's saved light/dark preset — never forces a skin over it. */
export function SiteHeader(_props: { logoClassName?: string | undefined; containerClassName?: string | undefined } = {}) {
  useEffect(() => {
    applyCurrentStylePreset();
  }, []);

  return <MainHeader />;
}
