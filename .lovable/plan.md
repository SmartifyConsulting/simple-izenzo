# Tidy the home page frames and fix the workflow diagram

## 1. Home page journey frames

The five journey boxes (Trading → Compliance & Governance → Execution → Finality → Memory) currently sit in a plain grid where the arrow is squeezed inside each box's own cell, so the boxes end up different widths and the arrows look cramped.

Changes:
- Lay the row out so all five boxes are exactly the same width and the same height, with equal gaps.
- Put a proper arrow glyph in its own space between each pair of boxes, vertically centred, clearly visible (not a faint text arrow).
- On narrow screens the row stacks vertically and the arrows rotate to point downward.

## 2. Sign in / sign up on the home page

Add the existing sign-in / sign-up card directly to the hero, beside the headline (below it on small screens), reusing the same tabbed card the `/auth` page uses — same fields, same behaviour, same password eye toggle and forgot-password link. After signing in the visitor lands on the Live Deal Engine, exactly as today. The `/auth` page stays where it is for direct links.

The hero becomes a two-column layout: copy, demo button and journey row on the left; the sign in / sign up card on the right.

## 3. Mahjong view line and arrow problems

Confirmed causes in the diagram's coordinate layout:

- Arrows that should drop into a box's top edge are drawn with the elbow turning vertically first, so the final leg runs sideways and the arrowhead points right instead of down. Every connector that ends on a top or bottom edge will be switched to turn horizontally first, so the last leg is vertical and the head points down.
- The gap between a line's end and the box border is only 5 units, so heads visually touch or bleed into the boxes. This gap will be increased and applied consistently on all four edges.
- Row pitch (82) versus box height (46) leaves only 36 units for a line plus arrowhead plus each frame's border and label chip, which is why lines look unspaced and some cross the group frames. Pitch will be increased and the group frames re-derived from the box positions so no frame border sits on top of a node or a line.
- The branch fan-out from KYC/KYB will run down to a single shared trunk line placed clear of the frame tops, then drop straight into each branch, instead of three lines bunching at the same point.
- Node columns will be re-aligned so vertically connected boxes share the same centre line, removing the diagonal-looking dog-legs.

Nothing about the workflow itself changes: same nodes, same steps, same gates, same click behaviour, same permissions and data.

## Technical notes

- `src/components/JourneyBanner.tsx` — equal-width grid with dedicated arrow cells, responsive rotation.
- `src/routes/index.tsx` — two-column hero, mounts `AuthTabs` (`src/components/auth/AuthTabs.tsx`) with `next="/live-deal-engine"`.
- `src/components/canvas/MahjongView.tsx` — geometry constants (`ROW`, `PITCH`, `EDGE_GAP`, `BOXES`, `GROUPS`), `elbow` `via` arguments corrected to `"x"` for top/bottom targets, `branchDown` trunk offset.
- Presentation only; no database, server function or business-rule changes.
