# Izenzo — Node Canvas Redesign

A full visual and interaction redesign. The app stops being a set of menu-driven pages and becomes one living deal canvas: bids run down the left lane, offers/responders down the right, and each module window opens as the deal advances. No database, workflow or business rule changes.

## The canvas

One screen per deal, two vertical lanes:

```text
        BIDDER                                RESPONDER
        ------                                ---------
        [ Bid ]                                 [ Offer ]
        [ I.D. ]  auto-filled from memory       [ I.D. ]
        [ Deal Docs ]                           [ Deal Docs ]
              \                                  /
            =====  AI + AI+ search beam  =====
                    [ Counterparty choice ]
                    [ Social scan - background ]
                    [ Proof of Intent ]   1 token
                    ----------- gate -----------
                    [ WaD ]  KYC / KYB / AML     3 tokens
                    [ Business docs - AI served ]
                    ----------- gate -----------
        [ Concept | Pre-feas | Feas | Bankability ]
                    [ Implementation - workflow ]
                    [ Finality ]  ->  [ Memory ]
```

- Nodes are 3D glass tiles with depth, soft inner light and a teal signal edge.
- Movement is vertical inside a lane; the only horizontal move is the AI search beam that sweeps across to surface counterparties.
- Locked nodes sit dimmed and unreachable until the gate before them clears. Clearing a gate animates the next module opening into place.
- Clicking a node opens an inline glass panel over the canvas — the work happens there, then the panel collapses back into the node with its state stamped.

## Least intervention

- I.D. auto-populates from the stored profile/org; the user only confirms.
- One document drop instead of a form; AI reads it to infer deal nature and the document set needed later.
- Counterparty selection is a pick-one card list, not a form.
- Social/news scan runs in the background and only interrupts with a floating alert if it finds something adverse.
- Confirmations are single affirmative actions ("Yes, this one", "I'm in"), each one recorded as an event exactly as today.

## Two live lanes

Both parties appear as actors on the same canvas. Your own lane is fully interactive; the counterparty lane shows their nodes lighting up as they act, with a pending/waiting state while it is their turn. Data comes from existing transaction records and party rows — no new access paths.

## Navigation

The sidebar menu is removed. Its destinations become:
- Deal switching: a compact deal rail / command bar at the top of the canvas.
- Inbox, Tokens, Registry, Facilitation, Support, Funder, Auditor, Admin: surfaced from the same command bar, opening as glass overlay modules rather than separate pages. Routes stay intact so links and permissions keep working.

## Landing page

Rewritten copy — the "Trading · Compliance · Execution · Finality · Memory" strapline, the "A transaction is not a conversation" headline and the paragraph beneath it are removed. In their place: a short line about matching a bid to the right counterparty with proof at every gate, over a live miniature of the animated canvas. Sign-in panel stays.

## Look and feel

- Palette: Ink & Aqua — `#0d0f14` ground, `#1b2430` panels, `#14b8a6` signal/active, `#e8eef6` text.
- Frosted layered surfaces, subtle parallax on the canvas, glow only on active/next nodes.
- Motion: nodes ease in when unlocked, the AI beam pulses while searching, gates unlock with a short snap.

## Explicitly unchanged

- Database schema, RLS, grants, tokens/pricing (POI $10, WaD $30), the five-gate spine and every step key.
- Roles and gating: admins vs system admin (Integrations and Activity Log stay system-admin only), funder/auditor access.
- Encrypted integrations store and all server functions.
- The app does not trade commodities; wording throughout describes matching parties and recording proof, never commodity trading.

## Technical notes

- New `src/components/canvas/` — lane, node, connector, beam, gate and inline-panel components driven by the existing `SPINE` definition, so step keys stay the single source of truth.
- Existing step screens are refactored into panel bodies reused by the canvas; their submit handlers and server calls are untouched.
- Tokens rewritten in `src/styles.css` (`@theme inline`) so the new palette flows through every shadcn component; no hardcoded colours in components.
- `AppShell` becomes a canvas shell with the command bar; routes under `_authenticated` keep their paths and guards.
- Animation via CSS transitions plus the existing utility set; heavy libraries avoided.

## Build order

1. Palette, glass surface primitives, motion tokens.
2. Canvas primitives (lane, node, connector, beam, gate).
3. Trading gate wired end to end, including the search beam and counterparty pick.
4. Compliance, Execution, Finality, Memory nodes with their existing logic.
5. Command bar replacing the sidebar; overlay modules for the secondary areas.
6. Landing page rewrite.
