import { createFileRoute, Outlet } from "@tanstack/react-router";

/** Layout for /about and /about/$slug — both the About page (with its
 * writing/articles section, about.index.tsx) and the article detail page (about.$slug.tsx)
 * render through this Outlet. See the Insights/Responders layouts for why this split is
 * required by TanStack Router's flat-route path-prefix convention. */
export const Route = createFileRoute("/_public/about")({
  component: AboutLayout,
});

function AboutLayout() {
  return <Outlet />;
}
