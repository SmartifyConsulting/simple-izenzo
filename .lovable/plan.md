# Attachments on the record, plus a visual clean-up

## Part 1 — Save attachments against the bid or offer

### What's wrong today

On the Live Deal Engine, when a user attaches ID and deal documents and clicks
submit, only the **file names** are recorded against the bid/offer. The actual
files are never uploaded anywhere, so nobody can open them later — the panel
just lists names. (The older Simple Mode upload step does store the real files,
so the app already has a working pattern to follow.)

### What will change

- Every attached file is uploaded and stored against that specific bid or offer
  ID, so it can be opened again from any device, by anyone with access to the
  deal.
- Each stored file keeps its name, its kind (ID front, ID back, Document), its
  version, its fingerprint, and who uploaded it — exactly as recorded now, plus
  the file itself.
- The attachment list on the deal shows each file as a link that opens or
  downloads it, instead of a plain name.
- Re-opening a deal shows the same files, still openable.
- If an upload fails, the user is told which file failed, and the deal does not
  advance until the files are safely stored.
- File size and type are checked before upload, with a clear message when a file
  is rejected.

## Part 2 — Home page clean-up

Remove the three-column band near the bottom of the home page ("Proof of Intent
is a gate", "WaD before execution", "AI proposes, people decide") entirely.

## Part 3 — Green borders and no grid inside frames

- Every frame (panel/card) in the Settings tabs gets a green border.
- The Report frame gets a green border.
- Every frame in Token Management gets a green border.
- Frames inside Pricing, API's, and the Reports screens (Deals and Tokens) no
  longer show the faint grid pattern behind them — they sit on a solid surface.
  The same applies to Admin, Settings, and every screen inside Admin.
- All of those frames also carry the green border, for one consistent look.
- The background grid stays as-is on the home page and the deal workflow
  screens; only the listed screens lose it inside their frames.

## Part 4 — Top bar icons

- API's becomes a plug icon; Pricing becomes a dollar-sign icon.
- The text labels next to both are removed — icon only, with the name still
  shown on hover.

## Not changing

Gates, token costs, permissions, the workflow order, and all existing database
rules stay exactly as they are.

## Technical notes

- `submitDocuments` in `src/routes/_authenticated.live-deal-engine.tsx` inserts
  `documents` rows with `storage_path` empty. It will upload each file to the
  existing private `documents` bucket at `<transaction_id>/<ts>-<filename>`
  first, then insert with that `storage_path`, mirroring
  `src/components/guided/DocumentUploadStep.tsx`. The restore effect and the
  attachment list select `storage_path` and render signed-URL links
  (`createSignedUrl(path, 60)`). Upload failure aborts before `advance(...)`.
- Home page band: remove the `bg-muted/40` three-column `<section>` in
  `src/routes/index.tsx`.
- Green border: add a small `frame` utility in `src/styles.css` using the
  existing `--success` token (`border-color: var(--success)` at a readable
  opacity), applied to the card/panel wrappers on the listed screens rather than
  hardcoding a colour class.
- Grid: `ink-grid` is applied once on the `AppShell` root, so it shows through
  transparent cards. Frames on the listed screens get an opaque `bg-card` (plus
  the shell wrapper drops `ink-grid` on those routes) so no grid is visible
  inside them.
- Icons: swap `Tag` → `DollarSign` and `TerminalSquare` → `Plug` in
  `src/components/layout/AppShell.tsx` and drop the `<span>` labels, keeping the
  `title` attributes.
