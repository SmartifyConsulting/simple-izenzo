# Online Media Checks, plus a synchronised workflow map

## 1. Replace the raw browser pop-up

The grey "An embedded page ... says" box is the browser's own confirm dialog. Swap it for the app's own styled confirmation (same dialog style used elsewhere), asking "Release the party you chose and reopen the counterparty list?" with Cancel / Release buttons.

## 2. New step: Online Media Checks

Slots into the sequence directly after Counterparties and before Choice:

```text
Counterparties  ->  Online Media Checks  ->  Background screening  ->  Choice  ->  Intent  ->  Proof of Intent
```

How it behaves, matching the existing formula exactly:

- After you tick companies on Counterparties and press Continue, the Online Media Checks frame becomes the pulsing, bordered frame.
- It scans open web sources for each ticked company using Bright Data: LinkedIn, Facebook, TikTok, X/Instagram, marketplace and directory listings, plus the company's own site.
- A progress bar runs underneath the frame in the same blue as the other running steps, turning red if a source fails.
- Results list per company: presence found, follower/activity signal, any adverse mentions, and links to what was found. Each company has a tick box.
- A Continue button at the bottom hands the ticked companies to Background screening, which then becomes the pulsing frame, exactly as it does today.
- Findings are saved against each counterparty so the results stay visible when you come back.

## 3. Mahjong map synchronised with the Classic sequence

- Clicking any box on the map opens the Classic detailed sequence at that same step, instead of only opening a small inline panel.
- The map always shows the step you are actually on as the pulsing box, including the new Online Media Checks box, which is added to the map between Counterparty and the screening branch.
- Every map box maps to the same step the Classic view uses, so both views always agree on where you are.

## 4. Map colours

- "Without a Doubt" loses its orange treatment and uses the standard frame styling; it keeps its "hard gate, non-waivable" line.
- "Proof of Intent" and "KYC / KYB" get the same border styling as the Step 3 boxes.

## Technical notes

- `src/lib/spine.ts`: add step `online-media` ("Online Media Checks") between `counterparties` and `choice`; the existing `media` key stays as background screening.
- New `src/lib/onlineMedia.functions.ts` + `.server.ts`: server function taking `transactionId` + `counterpartyIds`, reusing `fetchPageText`/`summarisePage` from `brightdata.server.ts` across a fixed source list per company; returns per-company findings and persists them into `counterparties.media_flags` (Json, already present — no migration needed). Degrades with a clear note when Bright Data is not configured, mirroring `lookupCompanySite`.
- `src/components/canvas/DealCanvas.tsx`: new node + progress bar + results block reusing the screening result markup; `onMediaContinue` prop; replace `window.confirm` at line 726 with `AlertDialog`.
- `src/routes/_authenticated.live-deal-engine.tsx`: extend `flowStep`/`throbStep` with a `media-checks` phase, advance to `trading/online-media` on Counterparties Continue, then to `trading/media` on Online Media Continue; store `mediaResults` alongside `screeningResults`.
- `src/components/canvas/MahjongView.tsx`: add an Online Media node in the centre column; `WaD` tone `danger` -> `light`; `poi` and `kyc` tone -> `light`; node `onClick` sets view mode to classic and navigates to the deal at that step rather than opening `InlineFrame`.

## 5. Register Bid / Register Offer from the map

- Clicking "Register Bid" or "Register Offer" on the map opens the split screen: the workflow sequence on one side and the Live Workspace on the other.
- Register Bid keeps today's layout: workflow on the left, Live Workspace on the right.
- Register Offer runs the identical process, but the two panes are swapped: Live Workspace on the left, workflow on the right.
- The chosen side sticks for the rest of that deal, so an offer always reads the mirrored way round.

Technical note: `MahjongView`'s `onRegister("bid" | "offer")` switches to the classic split view and records the direction; `_authenticated.live-deal-engine.tsx` reads the deal direction and reverses the two grid columns for offers.
