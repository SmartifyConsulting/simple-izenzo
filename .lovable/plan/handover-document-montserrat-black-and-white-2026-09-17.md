# Handover document — Montserrat, black and white

You send two things to the client: the ZIP of the source code and the Word document. The ZIP is already final and does not change. The Word document gets reformatted.

## What changes in the document

- Montserrat throughout — headings, body text, tables and code blocks (code blocks keep a fixed-width look through spacing, since Montserrat is not monospaced).
- Black and white only: no blue headings, no coloured table shading, no coloured links. Headings become black and bold, table header rows use a light grey fill and thin black rules, and links show as plain black underlined text.
- Everything else stays as it is: title page, contents list, all sections A–X, Letter page size, 1-inch margins, page numbers centred in the footer.
- The content is not rewritten — only the look changes.

## Output

- New file in Files: `Izenzo-Integration-Handover-v3.docx`. The existing v2 and the markdown version stay untouched.
- Every page is rendered as an image and checked before delivery: correct font in use, no colour left anywhere, no clipped table columns or overflowing code lines.

## One thing to know

Montserrat is a Google font and is not installed on most Windows machines by default. If the client's Word does not have it, Word will silently substitute another font. To avoid that, the font files are embedded inside the document, so it looks the same on their machine whether or not they have Montserrat installed. This makes the file somewhat larger — that is the only side effect.

## Technical notes

- Reuse the existing pandoc pipeline in `/tmp/docxbuild`: download the Montserrat family (regular, bold, italic, bold-italic), set them in the patched `reference.docx` `theme1.xml` and in the `styles.xml` run fonts, and add `<w:embedRegularFont>` / bold / italic entries plus the obfuscated font parts and relationships so the family travels with the file.
- Strip the accent colours from `styles.xml` (heading `w:color`, `Hyperlink` style colour) and from table styles; replace shading fills with `auto`/`D9D9D9` greys.
- Keep the existing `patch_out.py` step that re-inserts `sectPr` (Letter size, margins, footer reference) after pandoc drops it.
- Render with LibreOffice → `pdftoppm` and read every page image before copying `final.docx` to `/mnt/documents/Izenzo-Integration-Handover-v3.docx`.
- No project source files change.
