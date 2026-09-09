# Admin cards, menu icons and token colours

## Admin screen
- Show all admin sections as one flat grid of cards — no "Platform" / "Money" headings, no grouping.
- Each card gets a green border (matching the green frames used elsewhere) and its own icon above the label:
  - Users, API Keys, Integrations (system admin only), Activity Log (system admin only), Payments.
- Remove the Tokens card from Admin. Token figures stay available through the report menu's Token Management.

## Top menu
- Remove the word "Report" from the menu — the chart icon alone opens the menu (All Deals, Token Management).
- Make every menu icon noticeably larger and higher contrast, so Pricing, API's, Report, Inbox and the view switch all read clearly.

## Token pill (top right)
- No hover effect and no tooltip on the token pill; clicking it still opens Token Management.
- The coin icon takes the same colour as the Izenzo logo mark, so the two match.

## Account Status (Token Management)
- The "Used" portion of the balance doughnut and its legend dot become green instead of the dark shade.

## Technical notes
- `src/routes/_authenticated.admin.tsx`: flatten `ADMIN_GROUPS` into a single tab list with an `icon` per tab; card markup gets `border-success/55` plus a lucide icon; drop the `tokens` entry (keep `TokensTab` unused-free by removing it, or keep it reachable only from `/credits`).
- `src/components/layout/AppShell.tsx`: icon sizes `h-4 w-4` → `h-5 w-5`, colour `text-muted-foreground` → `text-foreground/80` with `hover:text-primary`; remove the `Report` label span; token pill loses `title` and `hover:opacity-90`, icon coloured with the logo's `text-primary` mark colour.
- `src/routes/_authenticated.credits.tsx` + `TokenDonut`: swap the `bg-sidebar` / dark arc for the `success` token.
- Verify with `bunx tsgo --noEmit`, route checks on `/admin` and `/credits`, and a screenshot of both.
