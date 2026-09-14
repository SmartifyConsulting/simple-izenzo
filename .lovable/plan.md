# Bid frame, Step 2 order, pulsing and Trade Summary timing

## 1. Remove the outer frame around "Enter bid description"

In the Live Workspace, the description + upload bar currently sits inside a second bordered,
textured panel within the Bid Registration frame. That inner panel goes away, so the bar sits
directly inside the Bid Registration frame — nothing else about the bar changes.

The bar itself also gets slimmer and less chunky: a lighter single-hairline outline, softer
corners, tighter padding and a smaller round submit button. The dashed "Drop files here" outline
becomes noticeably clearer — a stronger dash colour and thicker dashes — so it is easy to see.

## 2. Put KYC, KYB, PEP, AML before Without a Doubt

In Step 2 the order becomes:

```text
Proof of Intent  ->  KYC, KYB, PEP, AML  ->  Without a Doubt  ->  Business Docs
```

Applied in both views: the workflow map tiles (and the arrows between them) and the vertical
step list, so the two never disagree.

## 3. Pulsing and triggered activities

- The KYC/KYB/PEP/AML row currently never lights up, because no state is assigned to it. It will
  follow the same state as the checks themselves: pulsing while the checks are outstanding,
  green once they are complete.
- Without a Doubt then pulses only after those checks are complete, matching the new order.
- Clicking either row opens the same compliance panel it opens today, so the activity that gets
  triggered stays correct.

## 4. Trade Summary appears later

Today the Trade Summary appears as soon as the compliance checks complete. It will instead appear
only once the Step 2 documents (Business Docs — POI, NDA, MOU, Contract) have been submitted and
that item reads as complete.

## Technical notes

- `src/components/canvas/DealCanvas.tsx`: drop the `ink-grid ... border border-border` wrapper
  around `startNode` in both the picking and non-picking returns (keep spacing). On the bar itself:
  `border-2` -> `border`, `rounded-2xl` -> `rounded-xl`, `p-2` -> `p-1.5`, submit button
  `h-10 w-10` -> `h-8 w-8`. Dashed drop zone: `border-dashed` -> `border-2 border-dashed` with a
  stronger idle colour (`border-muted-foreground/70`).
- `src/components/canvas/MapView.tsx`: swap the `BOXES.withoutADoubt` / `BOXES.wad` y positions
  and the node render order so the KYC/KYB/PEP/AML tile sits above Without a Doubt; connector
  lines follow the same order (`poi -> wad -> withoutADoubt -> businessDocs`). Give the checks
  tile its own override key (`kycKyb`) so the two tiles can differ.
- `src/components/canvas/ClassicView.tsx`: move the `kycKyb` item above the `wad` item in `STEPS`
  step 2.
- `src/routes/_authenticated.live-deal-engine.tsx` (`stepOverrides`): set
  `o["kycKyb"]` where `o["wad"]` is set today, and make `o["wad"]` (Without a Doubt) `open` until
  the checks are done, `active`/`done` after — in both the persisted-intent branch and the live
  branch, keeping the existing POI gating.
- Same file, line ~2171: gate `<TradeSummary />` on the Business Docs item being complete
  (`wad_completed_at` present **and** the deal past the `business-docs` step) instead of
  `wad_completed_at` alone.
- Verify with a typecheck and a browser pass on `/live-deal-engine`.
