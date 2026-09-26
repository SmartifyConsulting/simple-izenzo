---
name: izenzo-lw
description: Exact Izenzo Live Workspace (LW) design system and mechanics — home page, Live Workspace, workflow Map vs Steps, tabs/taskbar, Trades screen, Inbox with archive, light (white default) and dark modes, fonts, colours, pills, statuses, pulsing, step unfolding and hyperlink routing. Use when building or restyling any Izenzo-style trade workspace screen.
---

# Izenzo LW

Rebuild screens so they look and behave exactly like Izenzo. Use semantic tokens only (`bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, `text-primary`, `bg-primary/10`). The only exceptions are listed below: royal blue tabs `#4169e1` and forced pure black in `pureBlack` shells.

## 1. Themes (white is the default)
Three style presets are stored in localStorage `izenzo:style-preset`. A change fires the window event `izenzo:style-preset-change`:
- `cream` (DEFAULT, white/cream light mode): sets `<html data-app="alpha-bravo">`.
- `black` (dark, Ink & Aqua): sets `data-app="izenzo"`.
- `grid`: same as black, plus `body.ink-grid`.
Every preset sets `data-theme="dark"`. What changes the look is `data-app`. Skin key: `izenzo:app-skin`. Call `applyCurrentStylePreset()` on AppShell mount. Tailwind variant: `@custom-variant theme-light (&:is([data-app="alpha-bravo"] *));`.

ThemeToggle: a 36px round button (`h-9 w-9 rounded-full border border-border text-foreground/80 hover:text-primary`). It sits top-right in the header next to the avatar. It shows a Moon in light mode and a Sun in dark mode. It flips between cream and black.

### Light tokens (`[data-app="alpha-bravo"]`)
background `oklch(0.98 0.006 90)` · foreground `oklch(0.19 0.01 260)` · card `oklch(1 0 0)` · primary `oklch(0.19 0.01 260)` · throb-accent `oklch(0.63 0.15 155)`. Headings use Space Grotesk, body uses Inter (Manrope fallback).

### Dark tokens (Ink & Aqua, `:root`)
background `oklch(0.16 0.008 260)` · foreground `oklch(0.94 0.012 250)` · card `oklch(0.255 0.02 253)` · primary `oklch(0.78 0.12 178)` · success `oklch(0.71 0.13 172)` · warning `oklch(0.78 0.14 78)` · info `oklch(0.75 0.14 230)` · border `oklch(1 0 0 / 42%)` · throb-accent `oklch(0.78 0.12 178)` · taskbar-active-bg `oklch(0 0 0)` with green text · step-pill-bg `oklch(0.82 0.005 260)` · lw-pill-bg `oklch(0.52 0.005 285)`.

## 2. Typography
- `--font-sans`: "Manrope Variable","Manrope",system-ui,-apple-system,sans-serif (body)
- `--font-heading`: "Sora Variable","Sora",system-ui,sans-serif (h1–h4)
- `--font-greeting`: "Montserrat" weight 700 (stands in for Gotham Bold). Used for the greeting "Good morning/afternoon/evening, {firstName}".
- Mono: IBM Plex Mono / ui-monospace, for hashes, seals and references
- Signatures: Great Vibes, Caveat, Dancing Script, Alex Brush, Sacramento, Allura, Pacifico, Cedarville Cursive, Marck Script, Parisienne. Render the signer's FULL name. The bidder and the counterparty always get different styles.
- Load fonts with `<link>` tags in `__root.tsx`, never with a remote `@import`.
- Sizes:
  - Greeting: `text-[1.75rem] sm:text-[2rem] leading-[1.15]`; in wide shells, `text-[1.15rem] sm:text-[1.3rem]`.
  - Page title: `mt-2 text-sm font-semibold text-muted-foreground`.
  - Description: `text-xs`.
  - `label-caps`: 11px, uppercase, `tracking-[0.15em]`, semibold.
  - Row text: `text-xs`. Meta text: `text-[11px]`. Pills: `text-[10px]`.

## 3. Outer frame (AppShell)
- The root is `flex min-h-screen flex-col overflow-x-hidden bg-background`. It adds `flat-frames` on /account, /admin, /credits, /trades, /activity, /developer and /docs, and `ink-grid` everywhere else.
- `<MainHeader/>` sits on top.
- `<main>` is `mx-auto w-full flex-1 px-4 sm:px-6` with a width of `max-w-7xl` (standard) or `max-w-[1680px]` (wide, used for LW). Top padding is `pt-5` (standard) or `pt-3` (wide). Bottom padding is `pb-24`, `pb-16` (compactFooter) or `pb-4` (hideFooter), because the footer is fixed to the viewport.
- The heading row is `grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 mb-4` (`mb-2` when wide), with the actions on the right.
- The footer is SiteFooter (fixed). LW hides it because the workspace taskbar takes that strip.
- A heartbeat updates `profiles.last_accessed_at` every 60s while the tab is visible. This drives the presence dot: green, amber or red.

## 4. Home page (`/`)
- The section is `mx-auto max-w-6xl px-5 py-6 sm:py-8`, laid out as `grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]`.
- Left column:
  - A pill badge: `rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary` with a Sparkles icon and the text "AI-Powered Trade Matching".
  - H1 "Governance Infrastructure Marketplace": `mt-3 text-4xl sm:text-5xl leading-[1.05] tracking-tight`.
  - `<SubmitBidButton size="sm"/>`.
- Right column (signed out, or sign-up still in progress): a card `rounded-2xl border bg-card p-3.5 shadow-sm` containing `<AuthTabs compact/>`.
- Then `<HeroMatchCard/>` at full width (`mt-5`).
- Signed in: ActiveDealsPanel (`mt-4`).
  - It lists up to 10 open deals, excluding the finality and memory stages, sorted by `updated_at` desc.
  - Each row is a Link to `/live-deal-engine?tx={id}`, styled `rounded-lg border border-l-4 px-2.5 py-1.5 text-xs hover:bg-muted/50` with the creator colour on the left border.
  - Row content: reference (or the fallback `BID…`) · name · "Created {when}" · a creator-name pill · a stage pill. Pills are `rounded-full px-1.5 py-0.5 text-[10px] font-medium` with the creator tone badge.
  - When there are exactly 10 rows, show "View all in Trades →" linking to `/trades`.
- "How a match plays out" (label-caps) / "Five stages, one governed flow." (`text-2xl sm:text-3xl`).
  - Five cards in `sm:grid-cols-2 lg:grid-cols-5`: `rounded-2xl border bg-card p-4`.
  - Hover: `-translate-y-1 border-primary/40 shadow-lg shadow-primary/5`, plus a top bar `h-1 bg-primary scale-x-0 → scale-x-100` from the left.
  - Each card has a number (`text-xs text-primary`), an icon chip (`h-7 w-7 rounded-full bg-primary/10`, which turns solid primary on hover), a title, a tag and a body.
  - Stages: 01 Trading (Find, Match & Verify), 02 Compliance & Governance (Engage), 03 Execution (Deliver), 04 Finality (Finalize), 05 Memory (Remember).
- Redirects:
  - Signed in with `?next=` → navigate to the safe `next` (must start with `/` and not `//`).
  - Signed out with `next` → `/auth?next=`.
  - A fresh visit with no `next` stays on home.
- Creator colour: `creatorTone(created_by)` picks a stable palette colour from the profile id. It returns `{border, badge}`.

## 5. Live Workspace (`/live-deal-engine?tx=`)
- Uses a wide AppShell with the footer hidden. Heading: label-caps "Izenzo Trade Workflow".
- A Map / Steps toggle group (buttons with `aria-pressed`). The active button is solid primary; inactive buttons are ghost/border.
- Window modes: minimized, docked, maximized, popped (min/max/popout/close controls).
- When `counterparty_org_id === org.id`, show the read-only CounterpartyWorkspaceView and override `--throb-accent` to `#4169e1`.
- Deals with an `INV…` reference redirect to `/case/$ref`.
- For orgs on the INTERPOL template, RelabelScope applies the lexicon: Bid→Starting Evidence, Counterparty→Entity, Seal Intent→Freeze Intent, Deal→Investigation.

### Workspace taskbar (bid tabs)
- Fixed to the bottom of the viewport. Holds one tab per open deal, stored in the `user_workspace_tabs` table so tabs follow the user across devices. Tabs can be dragged to reorder.
- Inactive tab: `bg-[#4169e1] text-white`. Active tab: `bg-white text-[#4169e1] border-[#4169e1]`. In dark taskbar-active mode: black background with green text.
- Closing a tab opens a confirm modal: "Save and Close" or "Cancel Bid".
- "New tab" opens a fresh bid.

### Map (MapView)
- A fixed 960×1050 coordinate system with a BOXES tile map (mahjong-style tiles for the five gates and their steps). Scale it to fit the width.
- Tile states:
  - done: success / yellow once the gate is complete
  - current: pulsing `animate-throb-aqua`
  - upcoming: muted
- Clicking a step tile opens the step frame inline (or `/tx/$id/$stage/$step`).

### Steps (ClassicView)
- STEPS are made of SubItems `{key,label,stage,step,icon,sub,isEntry,indent,heading}`.
- One accordion per gate, in this fixed order: 1 Trading · 2 GRC (Compliance & Governance) · 3 Execution · 4 Finality · 5 Memory.
- Gate bar colours: active is grey and expanded; complete is yellow (warning) and collapsed.
- **Progressive unfolding:** only the current gate is expanded. Inside it, sub-steps show one at a time. The current sub-step is expanded with a pulsing border; completed ones collapse to a single ✓ row; later ones stay hidden or locked.
  - Confirming Intent turns Trading yellow and opens GRC.
  - When every Legal Agreement has both signatures, GRC turns yellow and collapses, and Execution opens (Concept frame + AI summary + a disabled Continue).
  - Completing WaD fires confetti and advances automatically, with no Continue button.
- GRC order: Seal Intent → The Offer (Approve · Reject · Challenge) ↔ Counter Offer loop → Without a Doubt (KYC/KYB) → Business Docs / Legal Agreements (Document Register with uploader + timestamp, bilateral signatures).

## 6. Pulsing
Set `--throb-accent` per theme.
- `animate-throb`: 1.6s ease-in-out infinite. An expanding box-shadow ring (0 → 8px) in primary.
- `animate-throb-aqua`: 1.8s. Keyframe values:
  - box-shadow: `0 0 0 0` at 85% accent → `0 0 0 14px` at 0% accent
  - background: 14% → 4% accent
  - border: 95% → 55% accent
- Other keyframes: `node-start-pulse` (entry node), `signal-pulse`, `beam-sweep`, `ribbon-sweep`, `node-rise` (tiles rising in), `ellipsis-dot` (loading dots).
- Pulse ONLY the single next action the current user must take. Never pulse anything for the other party.

## 7. Trades screen (`/trades`)
- AppShell with title "All Trades" and the description "Every trade you have started, from early drafts to sealed agreements." Uses flat-frames.
- Search params: `q`, `userId`, `userLabel` (for deep links from Admin > Organisations).
- A searchable, filterable table:
  - reference (mono)
  - title/commodity
  - creator pill (creator tone)
  - stage pill
  - created/updated dates
- Clicking a row opens `/live-deal-engine?tx={id}`.

## 8. Inbox (`/inbox`) with archive
- Tabs: Inbox / Archive. Each notification row shows an unread dot, an enlarged bid ID (mono, bold), the message, and the time.
- Actions:
  - Archive moves an item to the Archive tab.
  - Restore moves it back.
  - Mark read clears the unread dot.
- Links:
  - Deal notification → `/live-deal-engine?tx={transaction_id}`
  - Counterparty claim → `/counterparty/claim?token=…`

## 9. Pills & statuses
- Base pill: `rounded-full px-1.5 py-0.5 text-[10px] font-medium`.
- Stage values: trading, compliance, execution, finality, memory.
- Tones: success = done/signed, warning = pending/yellow gate complete, info = in review, destructive = rejected/opt-out.
- Status pill (grey `--step-pill-bg`) shows the step. The LW pill uses `--lw-pill-bg`.
- Token pills show the person's main organisation balance.
- Verified badge appears after sign-up step 3.

## 10. Hyperlink matrix
| From | To |
|---|---|
| Home active deal / Trades row / Inbox deal | `/live-deal-engine?tx=` |
| View all in Trades | `/trades` |
| Signed-out deep link | `/auth?next=` |
| Map/Steps step | inline frame or `/tx/$id/$stage/$step` |
| INV reference | `/case/$ref` |
| Inbox claim | `/counterparty/claim?token=` |
| Admin org → trades | `/trades?q=` or `?userId=&userLabel=` |

## 11. Invariants (never break)
- The five-gate order is immutable.
- POI is immutable once sealed.
- WaD must be complete before Execution/Finality.
- AI+ is advisory only; every decision is human, attributed and append-only.
- GovernanceCard is visible only to georgia.adams@smartify.co.za and `@georgiaadams.co.za` accounts.
