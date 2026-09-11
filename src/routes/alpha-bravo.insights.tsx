import { createFileRoute, Outlet } from "@tanstack/react-router";

/** Pathless-ish layout for /alpha-bravo/insights and /alpha-bravo/insights/$slug — both the
 * listing (insights.index.tsx) and the article detail page (insights.$slug.tsx) render through
 * this Outlet. */
export const Route = createFileRoute("/alpha-bravo/insights")({
  component: InsightsLayout,
});

function InsightsLayout() {
  return <Outlet />;
}
