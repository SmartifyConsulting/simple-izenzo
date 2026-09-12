# Save the top 5 matches and carry them into the workspace

## What changes for you

1. **The five results are saved.** When a search runs on the public page (prompt typed and/or documents attached), the five matches shown — with their findings, match percentages and source links — are kept, together with the search prompt and the names of the attached documents.
2. **"See more" opens the workspace with those exact results.** The right-hand panel opens with the saved query summary at the top, the same five matches first (in the same order), then the rest of the matches underneath. No fresh unrelated list.
3. **The workflow list reflects what already happened.** In that arrival state, on the left:
   - "Upload documents" — green with a tick
   - "Search AI + AI+" — green with a tick
   - "Online Media Screening" — highlighted and pulsing as the current step, with a progress bar underneath it
   - Later steps stay as they are today
4. **Naming.** The workflow panel is titled "IZENZO TRADE WORKFLOW", and any remaining "Engine Map" wording is changed to match.
5. **The media screening actually runs** on the saved matches where the scraping connection is available; the bar fills as each one is checked and the results appear underneath. If the scraping service is unavailable, the bar completes and a plain note says the screening could not be completed, rather than pretending it passed.
6. **Summary of the Proposal.** Above the results, a bulleted summary of the material aspects of the trade read from the uploaded document and prompt — what is offered or wanted, quantity and units, price and currency, delivery/location, terms and dates — only the facts actually present, nothing invented or padded.
7. **Who submitted it.** The submitting business or individual name is shown at the top of that summary, with the Verified badge next to it when their identity checks have passed (no badge otherwise).
8. **Results are selectable.** Each result row carries a radio button so exactly one party can be chosen, which is what carries forward into the next step.


## Technical notes

- `src/lib/heroSearchContext.tsx`: extend the shared context to hold a saved search snapshot `{ prompt, fileNames, matchIds, savedAt }` and mirror it to `sessionStorage` (key `izenzo:hero-search`) so it survives the navigation and the sign-in round trip.
- `src/components/marketing/HeroMatchCard.tsx`: on a successful search, write that snapshot (the five row ids in display order plus the prompt/file names). "See more" keeps its existing link; it no longer needs to pass the whole result set through the URL.
- `src/components/canvas/MatchResultsPanel.tsx`: read the snapshot; render a "What you asked for" block showing the prompt and attached document names; fetch the saved ids by `in(...)`, order them exactly as saved, render them first under a "Your top 5" heading, then the remaining matches below. Falls back to today's plain query behaviour when no snapshot exists.
- `src/components/canvas/ClassicView.tsx`: add optional `overrideStates?: Record<string, NodeState>` and `progress?: { key: string; percent: number; note?: string }`. Done rows show a `CheckCircle2` tick; the override row uses the existing `active` styling (`animate-throb-aqua`); the progress bar reuses the same blue treatment as the Background screening bar in `DealCanvas.tsx`.
- `src/routes/_authenticated.live-deal-engine.tsx`: when `panel === "matches"` and a snapshot exists, pass `overrideStates` (`bidOffer`/`search` → done, `onlineMedia` → active) and the live media progress into `ClassicView`; kick off `runOnlineMediaChecks` for the saved match ids, driving the percentage and storing results as it already does for the in-deal flow. Update the "Engine Map" comments/labels to the new name.
