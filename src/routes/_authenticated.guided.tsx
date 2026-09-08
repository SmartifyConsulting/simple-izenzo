import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { TradingBoard } from "@/components/guided/TradingBoard";
import { ProfileAvatarMenu } from "@/components/guided/ProfileAvatarMenu";
import { ModulesShowcase } from "@/components/guided/ModulesShowcase";

export const Route = createFileRoute("/_authenticated/guided")({
  head: () => ({
    meta: [{ title: "Simple Mode — Izenzo" }],
  }),
  component: Guided,
});

/** Simple Mode: a single-page trading board. Bid to Buy and Bid to Sell on the outside lanes,
 * with matches aggregating in the middle as they happen. The Modules showcase below is a staging
 * area for folding the classic layout's modules into this page. */
function Guided() {
  return (
    <AppShell
      title="Simple Mode"
      description="Buy on the left, sell on the right — matches aggregate in the middle as they happen."
      actions={<ProfileAvatarMenu />}
    >
      <TradingBoard />
      <ModulesShowcase />
    </AppShell>
  );
}
