# Smarter Search + a tighter workflow diagram

Two pieces of work: make the top-bar Search find and rank counterparty matches with AI, AI+ and live web lookup, and tidy the Mahjong workflow diagram so it fits on one screen with clean arrows.

## 1. Search finds and rates matches

Today the Search button only looks inside our own records (registry companies, known counterparties, commodities already traded).

After this change, one search runs three sources at once:
- our own records (as now),
- AI and AI+ suggestions of likely counterparties,
- a live web lookup through Bright Data for candidates that have a website.

Each result shows where it came from (AI, AI+, Web) and a closeness rating out of 100. Results are sorted strongest match first, so the closest matches sit at the top. Anything from AI is clearly labelled as a proposal — a person still decides. Every result can still be added to the Screen List.

While the deeper sources are still working, the records results appear immediately and the AI/web ones fill in as they land. If AI or the web lookup is unavailable, the search still returns records results with a small note.

## 2. Mahjong view fits on one screen

- Compact the whole diagram so it no longer needs scrolling: shorter rows, tighter vertical spacing and a wider-than-tall canvas that scales into the visible area.
- Every arrow starts touching the box it leaves and its tip touches the box it points at.
- Move Step 3 and Step 4 up by roughly one centimetre.
- Space Steps 3, 4 and 5 evenly across the width.
- Align each sub-node with the nearest edge of its parent (Concept/Feasibility under the left edge of Project Preparation, Pre-feasibility/Bankability to its right; Implementation under Execution; Payment/Completion under Finality).

Nothing about the workflow itself changes: same steps, same gates, same clicks, same permissions and data.

## Technical notes

- `src/components/layout/SearchButton.tsx`: keep the existing Supabase query as the fast first pass; add parallel calls to `discoverCounterpartiesByQuery` (kind `ai` and `ai_plus`) and the `counterparty-discovery` edge function, then `checkCandidateProducts` (Bright Data path) for a capped number of results that carry a URL. Merge into one ranked list using the same averaging approach as `_authenticated.discover.tsx` (`rankScore`), dedupe by name, and map results into `ScreenListItem` so adding to the Screen List keeps working. Debounced/on-Enter trigger for the expensive sources; the cheap record search stays as-is.
- No server-side changes; existing server functions and RLS are reused unchanged.
- `src/components/canvas/MahjongView.tsx`: adjust the fixed `W`/`H` coordinate system (reduce `H`, keep `W`), `ROW`, `PITCH`, `BRANCH_Y`, and the branch column x-positions; set `EDGE_GAP` to `0` for connector endpoints so paths meet borders exactly (arrowhead `refX` tuned so the tip lands on the border, not inside it); recompute `GROUPS` frames from the node boxes rather than hard-coded x/w values so Steps 3, 4 and 5 come out evenly spaced.
- Verify with a typecheck and a screenshot of `/live-deal-engine` in the diagram view at a normal desktop height.
