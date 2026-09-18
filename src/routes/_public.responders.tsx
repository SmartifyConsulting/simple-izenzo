import { createFileRoute, Outlet } from "@tanstack/react-router";

/** Layout for /responders and its sector/$sector and location/$jurisdiction variants —
 * see the Insights layout for why this split (index + Outlet) is required by TanStack Router's
 * flat-route path-prefix convention. */
export const Route = createFileRoute("/_public/responders")({
  component: ResponderLayout,
});

function ResponderLayout() {
  return <Outlet />;
}
