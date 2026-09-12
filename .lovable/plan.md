# Live Workspace tidy-up and a truthful pulsing workflow

## What changes

1. One heading only in a new workspace
   - The blank workspace currently shows "Live Workspace" twice, one under the other. The second one goes; the panel keeps a single heading, and once a bid exists that spot shows the bid/offer reference as it does today.

2. Bid/Offer ID at the top right
   - The reference text gets noticeably larger and stays bold monospace so it reads as the identifier of the deal.
   - The pill holding it is halved in width, so it is a compact badge rather than a wide bar.

3. A Submit button for the workspace search
   - Below the attached files list, a full-width "Submit" button starts the search on demand, instead of relying only on the automatic run.
   - It stays disabled while files are uploading or being read, and while nothing has been typed and nothing attached.

4. The step you are on always pulses
   - The workflow list on the left highlights and pulses the item that is genuinely current at that moment, at every point of the flow — not only during the media screening.
   - Completed items stay green and ticked; later items stay quiet.

5. Search AI + AI+ and Online Media Screening run together
   - Both start at the same time when a submission goes in, and both show as in progress at once rather than one waiting for the other.
   - When the result list appears, both are ticked and Choice becomes the pulsing item, so the next thing to do is obvious.

## Unchanged

- Gates, tokens, certificates and all business rules.
- What the search actually does and the scoring behind the percentages.
- The tab row, including the fixed "New" tab.

## Technical notes

- `src/routes/_authenticated.live-deal-engine.tsx`: drop the `draftReference ?? "Live workspace"` fallback heading (around line 1128) so only the panel's own `label-caps` heading remains; when a draft reference exists it still renders, larger.
- `OpenDealsPicker` trigger: `w-[280px]` → `w-[140px]`, reference text to `text-base font-bold` (popover content keeps its own width).
- `src/components/guided/DocumentUploadStep.tsx`: render the action button in `autoAdvance` mode too, labelled "Submit", calling the same `next()`; disabled while `uploading || reading` or with no docs and an empty prompt.
- Concurrency: where the page currently chains the media checks after `runSearch`, kick both off with `Promise.allSettled` from one submit handler, tracking two independent flags (`searchRunning`, `mediaRunning`).
- Pulsing: replace the matches-only `overrideStates` with a single derived map computed from the page's flow state for every phase — `documents` → `bidOffer` active; submitted → `bidOffer` done and `search` + `onlineMedia` active; results present → both done and `choice` active; after a choice → `choice` done and `poi` active. `ClassicView` already renders `active` with `animate-throb-aqua` and `done` with a tick, so no styling change is needed there.
