import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { TradingBoard } from "@/components/guided/TradingBoard";
import { ProfileAvatarMenu } from "@/components/guided/ProfileAvatarMenu";

export const Route = createFileRoute("/_authenticated/guided")({
  head: () => ({
    meta: [{ title: "Simple Mode — Izenzo" }],
  }),
  component: Guided,
});

/** Simple Mode: a single-page trading board. Bid to Buy and Bid to Sell on the outside lanes,
 * a live trader ticker in the middle two that resolves into pinned match cards (terracotta for
 * buy matches, teal for sell matches) once a transaction has both sides. */
function Guided() {
  return (
    <AppShell
      title="Simple Mode"
      description="Buy on the left, sell on the right — matches aggregate in the middle as they happen."
      actions={<ProfileAvatarMenu />}
    >
      <TradingBoard />
    </AppShell>
  );
}
