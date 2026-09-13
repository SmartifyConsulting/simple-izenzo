# Live Workspace: a clean "Bid Registered" header and a searchable tab

## What changes on screen

### 1. "Bid Registered" card at the very top
The card currently reading "Bid recorded — New Bid" moves to the top of the Live Workspace, is renamed **Bid Registered**, and shows only:

- Registration date and time
- Business name (with its Verified / pending / not-verified badge)
- Country

No person's name appears anywhere in it.

### 2. Documents can be previewed
Every attached file keeps an eye (preview) and a download button in the one remaining attachment list, greyed out only when no stored copy exists.

### 3. Duplicated frames removed
- The second attachments frame with the orange "Attachments" pill is removed; the list inside the summary card is the only one, and it carries the ID Verified / ID check pending badge that used to sit on the removed frame.
- The "AI findings" frame is removed. If documents are attached but not yet read, the "These documents haven't been read yet" line plus the **Read documents** button moves into the summary card.

### 4. Ticked activities move to the workflow column
The two green ticks ("Bid Registration", "Submission of documents") leave the workspace and appear in the left-hand Izenzo Trade Workflow column. In the workflow list, the **Upload Documents** row is replaced by two ticked rows: **Bid Registration** and **Submission of Documents**.

### 5. Bid ID inline with the heading, as a label
The bid reference sits on the same row as the "Live Workspace" heading as a plain, larger label — no dropdown, no search box, not clickable.

### 6. A Search tab next to "+ New"
A tab with a magnifier icon sits immediately right of the permanent "New" tab in the bottom tab strip. Clicking it opens a search box where a bid ID or keyword finds a deal; picking a result opens that deal's workspace. This replaces the search that used to live on the bid-ID field.

## Technical notes

- `src/routes/_authenticated.live-deal-engine.tsx`
  - Move the `activity`/`dealTx` "recorded" block to the top of the workspace column, relabel it, and render registration timestamp, organisation name + `SubmitterIdentity` badge, and country (`organisations.country`, falling back to `transactions.jurisdiction`). Fetch the org name/country via the existing `useAuth().org` or a small `organisations` select keyed on `dealTx.org_id`.
  - Delete the second attachments `glass-node` (lines ~1295–1368) and reuse its `Eye`/`Download` row markup inside the summary card's list; move the ID badge there.
  - Delete the "AI findings" branch (~1166–1194); keep the unread-documents notice and `rereadDocuments` button inside the summary card. When no documents exist yet, `DocumentUploadStep` still renders as today.
  - Remove the ticked "Bid Registration / Submission of documents" block (~1247–1258).
  - Replace `OpenDealsPicker` in the heading row with a static `<span className="font-mono text-lg font-bold">` reference; keep `OpenDealsPicker` exported/unused-free by deleting it if nothing else references it.
- `src/components/canvas/ClassicView.tsx`: in step 1, replace the `bidOffer` "Upload documents" item with two items — `bidRegistration` ("Bid Registration") and `docSubmission` ("Submission of Documents") — both driven by `overrideStates` so they read as done once a bid exists with documents; the page's `stepOverrides` memo is updated to set both keys.
- `src/components/canvas/WorkspaceTaskbar.tsx`: add a `Search`-icon tab right after the "New" tab, opening a `Command`-based dialog listing open deals (same query shape as `OpenDealsPicker`: reference, title/commodity) and navigating to `/live-deal-engine?tx=<id>` on select.
