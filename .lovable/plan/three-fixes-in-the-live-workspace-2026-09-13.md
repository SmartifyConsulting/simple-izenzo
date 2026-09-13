# Three fixes in the Live Workspace

## 1. After files are added, show "Fetch Interest" — never the upload frame again

Once a bid has at least one attached file, the drop-file/description frame does not come back for any reason. In its place there is a single **Fetch Interest** button, shown whenever files exist and interest has not been fetched yet (not only in the brief moment straight after upload). Pressing it starts the search and the online media screening together, as it does now, and while they run the button reads "Fetching interest…" and is not clickable.

## 2. Rename the top card

"Bidder details & AI summary" becomes **BID INFORMATION**.

## 3. Ticked tasks lose their pill frame

In the Izenzo Trade Workflow column, completed items (for example Bid Registration and Submission of Documents) show as a green tick plus their label on a plain background — no bordered/filled pill around them. Items still to do keep their current framed look so the difference stays readable.

## Technical notes

- `src/routes/_authenticated.live-deal-engine.tsx`
  - Label at line 1142: `Bidder details & AI summary` → `BID INFORMATION`.
  - The block at lines 1243–1277: keep `DocumentUploadStep` only while `workspaceDocs.length === 0`. Replace the `flowStep === "documents"` condition on the Fetch Interest button with "docs exist and no match results yet" (`matches.length === 0` / equivalent state already used by the results panel), so a deal that has advanced past `documents` still offers the button until results land. Button label switches to `Fetching interest…` while `screening || mediaRunning`.
  - Confirm the `workspaceDocs` query key matches the one `DocumentUploadStep` invalidates, so the upload frame disappears immediately after the first upload.
- `src/components/canvas/ClassicView.tsx`
  - `SubRow` (line ~149) and the collapsed done row (line ~285): for `state === "done"`, drop `rounded-lg border … bg-primary/12` and render an unframed row (`border-transparent bg-transparent text-primary`), keeping the `CheckCircle2` icon and label.
