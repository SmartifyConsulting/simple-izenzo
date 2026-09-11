import { createFileRoute, Outlet } from "@tanstack/react-router";

/** Layout for /alpha-bravo/blog and /alpha-bravo/blog/$slug — both the listing
 * (blog.index.tsx) and the article detail page (blog.$slug.tsx) render through this Outlet. */
export const Route = createFileRoute("/alpha-bravo/blog")({
  component: BlogLayout,
});

function BlogLayout() {
  return <Outlet />;
}
