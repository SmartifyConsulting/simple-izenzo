# Map screen: tab strip back, one trade frame, wider compliance frame

## 1. Bottom strip on the Map

- The Map shows the tab strip again (New, Search, and one tab per open deal) instead of the site footer.
- The footer details — the Izenzo company line and the Glossary / Privacy / Terms / Support links — move into the middle of that same tab strip, centred between the tabs on the left and the right edge.
- Other screens are unaffected: they keep the tab strip exactly as it is, and the footer stays as it is everywhere else.

## 2. Opening a workspace on the right

- Clicking **New** in the tab strip, or the **Bid** tile on the map, opens a fresh Live Workspace on the right-hand side of the Map; the map stays on the left and shrinks to fit.
- Once a bid is registered there, the workflow continues exactly as it does now, with the pulsing tile on the map showing where you are.

## 3. Map drawing changes

- The yellow frame around Offer, Choice, Counter Offer and Social Media is removed; those four tiles now sit inside the green **1. Trade Engine** frame, which extends to cover them.
- Clear padding is added between frame 1 (Trade Engine) and frame 2 (Compliance & Governance Engine) so they no longer sit tight against each other.
- The connector between Social Media and frame 2 is reversed: it now runs from Social Media into the Compliance frame, instead of from Express Intent out to the counterparty group.
- Frame 2 is twice as wide as it is now and centred horizontally on frame 1; its tiles (Express Intent, POI, Without a Doubt, WaD, Business Docs) stay the same size and re-centre inside it.

## Technical notes

- `WorkspaceTaskbar.tsx`: drop `/map` from `isMarketingPath` so the dock renders there again; add a centred block inside the dock carrying the `SiteFooter` legal line and nav links (shared link markup, `flex-1 justify-center`, hidden below `lg` to protect the tabs).
- `_authenticated.map.tsx`: swap `compactFooter` for `hideFooter` (the dock owns the strip), and keep the existing right-pane iframe; the Bid tile already calls `onBid`. `New` opens the pane through the existing `/live-deal-engine?popout=true&fresh=1` source.
- `MapView.tsx`: delete `COUNTERPARTY_FRAME` and its `Frame` render; grow `TRADE_ENGINE_FRAME` to roughly `{ x: 14, y: 26, w: 1470, h: 420 }` so offer/choice/counterOffer/socialMedia fall inside. Move `COMPLIANCE_FRAME` down for padding and to `w: 660`, centred on the trade frame (`x ≈ 420`, `y ≈ 480`); shift the five compliance boxes to re-centre (`x ≈ 610`), and update the chain arrows plus the businessDocs → execution connector to the new coordinates.
- Replace the `expressIntent → counterparty` arrow with `line(bottomOf(BOXES.socialMedia), { x: cx(socialMedia), y: COMPLIANCE_FRAME.y })`-style connector pointing into frame 2.
- Presentation only: no gating, spine, server-function or database changes.
