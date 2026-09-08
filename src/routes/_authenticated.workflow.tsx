import { createFileRoute } from "@tanstack/react-router";
import { WorkflowPage } from "@/components/canvas/WorkflowPage";

export const Route = createFileRoute("/_authenticated/workflow")({
  head: () => ({
    meta: [
      { title: "Workflow View — Izenzo" },
      {
        name: "description",
        content: "The Trading Gateway flowchart, highlighting exactly where each deal stands.",
      },
    ],
  }),
  component: WorkflowView,
});

/** Workflow View: the same Live Deal Canvas the Trade Desk uses, surfaced as its own guided
 * view — pick a deal from the ticker and see the whole gate flowchart with the current step
 * highlighted, without the rest of the classic dashboard chrome around it. Presented as a clean
 * diagram with no grid backdrop; Workflow Grid is the same page with the grid on. */
function WorkflowView() {
  return (
    <WorkflowPage
      title="Workflow View"
      description="The Trading Gateway flowchart — your current step is highlighted."
      gridTheme="none"
    />
  );
}
