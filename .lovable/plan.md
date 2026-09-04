# Recolour Izenzo and match the TAG fonts

Swap the current charcoal/greyscale look for the navy + green scheme in the uploaded reference, and adopt the same typefaces the TAG project uses. Layout, spacing and density stay as they are.

## Palette taken from the image

- Deep navy (primary, sidebar, buttons, active spine step): `#1B237E`
- Soft indigo tint (page background wash): `#F4F5FD`
- Card white: `#FFFFFF`
- Emerald green (completed steps, success): `#1FB265`
- Cool grey (borders, muted text, pending steps): `#E3E6F0` / `#8A90A6`
- Deep navy panel (dark cards like the "Card Details" tile): `#151C5E`

## Fonts (from the TAG project)

- Body text: Manrope
- Headings: Sora
- Hashes, IDs and seal blocks keep a monospace face

This replaces the current Courier Prime body / DM Sans heading pairing, so the app reads as clean modern sans instead of typewriter.

## What changes

- All colour tokens in `src/styles.css` (light and dark) move to the values above: background, card, primary, secondary, muted, accent, border, input, ring, success, info, and the chart series.
- Sidebar goes from near-black to deep navy with light indigo text and a lighter navy active state.
- Success stays green (completed spine steps, sealed records); warning and destructive keep amber/red, retuned to sit beside navy.
- Font tokens point at Manrope (body) and Sora (headings); the buttons/nav rule follows the heading font.

## Where it shows up

- Sidebar, buttons and links become navy instead of black.
- The vertical spine: green ticks for completed, navy ring for current, grey for locked/pending — matching the reference stepper.
- Page background picks up the faint indigo wash so white cards read as cards.

## Technical notes

- Only `src/styles.css` token values change, plus the font loading; components already use semantic tokens (`bg-primary`, `text-muted-foreground`, `text-success`, `bg-sidebar`), so no component edits are expected.
- Fonts installed as `@fontsource-variable/sora` and `@fontsource-variable/manrope` and imported at the top of `src/styles.css` (same approach as TAG); the Google Fonts `<link>` for Courier Prime / DM Sans is removed from `src/routes/__root.tsx`.
- Colour values written as `oklch()` to match the existing token format, contrast checked in light and dark modes.
