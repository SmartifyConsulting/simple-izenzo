import { createFileRoute } from "@tanstack/react-router";
import { WorkflowPage } from "@/components/canvas/WorkflowPage";

export const Route = createFileRoute("/_authenticated/workflow-grid")({
  head: () => ({
    meta: [
      { title: "Workflow Grid — Izenzo" },
      {
        name: "description",
        content: "The Trading Gateway flowchart on its grid backdrop, highlighting each deal's step.",
      },
    ],
  }),
  component: WorkflowGrid,
});

/** Workflow Grid: identical to Workflow View — same data, same ticker, same Live Deal Canvas —
 * kept in lockstep via the shared WorkflowPage component. The only difference is presentation:
 * this one keeps the canvas's ink-grid backdrop instead of the clean diagram. */
function WorkflowGrid() {
  return (
    <WorkflowPage
      title="Workflow Grid"
      description="The Trading Gateway flowchart — your current step is highlighted."
      gridTheme="dark"
    />
  );
}
