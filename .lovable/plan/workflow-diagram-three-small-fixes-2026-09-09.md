# Workflow diagram: three small fixes

## 1. Arrow into "Surface routes / paths"
The link between Counterparty and Surface routes / paths currently has no arrowhead. Draw it downward from Counterparty into the top of Surface routes / paths, with a visible arrow tip touching that box.

## 2. Lower the shared line above the Step 3 / Step 4 arrows
The horizontal line that fans out from KYC / KYB into the three downward arrows sits close under the box. Drop it further down so it sits in the clear space between the Compliance frame and the Step 3 / Step 4 frames, with the three arrows still landing on the frame borders.

## 3. Resize and align Memory
Make the Memory block the same height as Completion and place it on the same line, so the arrow from Completion runs straight across into it. Shrink the Step 5 frame to fit the smaller block.

## Technical notes
All changes are in `src/components/canvas/MahjongView.tsx`:
- Replace the `arrow: false` connector at Counterparty/Surface routes with a downward elbow ending on `top(BOXES.surfaceRoutes)`.
- Increase the `branchDown` stub for the KYC fan-out so the trunk sits mid-gap between the Step 2 frame bottom and the Step 3/4 frame tops.
- Set `memory` to `h: ROW` at `y: BOXES.completion.y`, and derive the Step 5 frame height from that; the Completion → Memory connector becomes a straight horizontal line.

No data, routing, permissions, or workflow rules change.
