# Recolour Izenzo to the reference palette

Swap the current charcoal/greyscale look for the navy + green scheme in the uploaded reference, keeping the same layout, type and density.

## Palette taken from the image

- Deep navy (primary, sidebar, buttons, active spine line): `#1B237E`
- Soft indigo tint (page background / panel wash): `#F4F5FD`
- Card white: `#FFFFFF`
- Emerald green (completed steps, success): `#1FB265`
- Cool grey (borders, muted text, pending steps): `#E3E6F0` / `#8A90A6`
- Deep navy panel (dark cards like the "Card Details" tile): `#151C5E`

## What changes

- All colour tokens in `src/styles.css` (light and dark blocks) move to the values above: background, card, primary, secondary, muted, accent, border, input, ring, success, info, and the chart series.
- Sidebar goes from near-black to deep navy with light indigo text and a lighter navy active state.
- Success stays green (used by completed spine steps and sealed records); warning/destructive keep amber/red but retuned to sit next to navy.

## Where it shows up

- Sidebar, buttons and links become navy instead of black.
- The vertical spine: completed steps green ticks, current step navy ring, locked/pending steps grey — matching the reference stepper.
- Page background picks up the faint indigo wash so white cards read as cards.

## Technical notes

- Only `src/styles.css` token values change; components already use semantic tokens (`bg-primary`, `text-muted-foreground`, `text-success`, `bg-sidebar`), so no component edits are expected.
- Values written as `oklch()` to match the existing token format, with contrast checked for both light and dark modes.
