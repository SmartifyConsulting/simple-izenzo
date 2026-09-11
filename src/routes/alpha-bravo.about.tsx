import { createFileRoute, Outlet } from "@tanstack/react-router";

/** Layout for /alpha-bravo/about and /alpha-bravo/about/$slug — both the About page (with its
 * writing/articles section, about.index.tsx) and the article detail page (about.$slug.tsx)
 * render through this Outlet. See the Insights/Responders layouts for why this split is
 * required by TanStack Router's flat-route path-prefix convention. */
export const Route = createFileRoute("/alpha-bravo/about")({
  component: AboutLayout,
});

function AboutLayout() {
  return <Outlet />;
}
