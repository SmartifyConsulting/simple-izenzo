# Bring back the Mahjong map, laid out like your diagram

The old Mahjong (tile map) view still exists in this project's history — it was renamed into the current step list. I'll restore it as a separate view and rebuild its layout to match the attached map exactly.

## Where it lives

It becomes its own **Map** screen, listed in the main menu as the first item, before Home. Opening it shows the whole diagram; clicking any tile opens that step's frame, exactly as the step list does. The Live Workspace step list stays as it is. Nothing about the workflow, gates, tokens or permissions changes.

## Layout, following the attached map

Read left to right, in five labelled engines:

```text
1. TRADING ENGINE
  BID                                                    ┌─────────────────────────┐
   |                                                     │ OFFER  <───────────┐    │
  LOAD DEAL DOCUMENTS ──> SEARCH (AI and AI+) ──> STEPS ─┼─> CHOICE <──> COUNTER  │
                                                         │    |            OFFER  │
2. COMPLIANCE & GOVERNANCE ENGINE                        │  SOCIAL MEDIA          │
  EXPRESS INTENT ─────────────────────────────────────>  └─────────────────────────┘
   -> POI
   -> WITHOUT A DOUBT                                        5. MEMORY ENGINE
   -> WaD          (KYC, KYB, PEP, AML)                       Compounding CDA
   -> BUSINESS DOCS (POI, NDA, MOU, Contract)                       ^
        |                                                           |
        └──> 3. EXECUTION ENGINE ──> Entry / Exit ──> 4. Finality ──┘
             Concept, Pre-Reqs, Feas, Bankability,     Payment, Signoff, Handover
             Project Prep, Implementation
```

Specifics taken from the map:

- **Trading engine** across the top: BID on the far left with an arrow down to Load Deal Documents, then right to Search (captioned "AI and AI+"), then right into the small stacked Step 1–5 card, which feeds both Offer and Choice.
- **Counterparty group** on the right as its own soft-yellow rounded frame containing Offer, Choice, Counter Offer and Social Media, with the two-way arrow between Choice and Counter Offer and the return arrow from Counter Offer back up to Offer.
- **Compliance & Governance engine** as a tall green frame on the left, running Express Intent → POI → Without a Doubt → WaD → Business Docs, with an arrow from Express Intent across to the counterparty group.
- Side labels beside their tiles: "KYC, KYB, PEP, AML" next to WaD; "POI, NDA, MOU, Contract" next to Business Docs.
- **Execution engine** bottom centre with its sub-list underneath the title, then Entry / Exit, then Finality with "Payment, Signoff, Handover" beneath it.
- **Memory engine** as a circle top right of that row — "Compounding CDA (Capital Deployment Assessment)" — with an arrow coming up into it from Finality.
- Same tile colours as the map: yellow for BID, pale blue for documents/execution/finality, green frames for search and compliance, cream for the counterparty group, lavender circle for memory.

## Behaviour — driven by the live deal

- The map reads the real deal record from this database: stage, current step, intent confirmed, Proof of Intent sealed, screening and media results, tokens. The gating rules are unchanged from the Izenzo Canvas project and are reused as they are.
- Tiles reflect that state: cleared steps green with a tick, the current step pulsing, locked steps dimmed and unclickable with the existing lock reasons on hover.
- Clicking an unlocked tile opens the same step frame the step list opens, so any action taken on the map advances the deal exactly as it does today, and the map updates when it does.
- A deal picker at the top of the Map screen lets you switch between your deals; it opens on the most recent one.
- The whole diagram scales to fit the width without scrolling; on narrow screens it scales down rather than reflowing.

## Technical notes

- Restore `src/components/canvas/MahjongView.tsx` from commit `cf0827a^` as `src/components/canvas/MapView.tsx`, keeping its `nodeState`/`lockReason`/`stepIndex` wiring and `InlineFrame` click handling.
- Replace its vertical coordinate system with a wide fixed canvas (roughly 1600×1050) whose box table matches the attached map's positions; connectors keep the existing elbow/arrow helper, with endpoints touching box borders.
- New group frames: trading (implicit), counterparty (cream, rounded), compliance (green), plus the memory circle rendered as an SVG/rounded div.
- New route `src/routes/_authenticated.map.tsx` (`/map`) rendering `MapView` inside the existing shell, for the most recent deal (same deal selection the Live Workspace uses); `src/components/layout/MainHeader.tsx` nav list gains `{ to: "/map", label: "Map" }` as the first entry, before Home.
- Presentation only — no database, server function, spine or gating changes.
