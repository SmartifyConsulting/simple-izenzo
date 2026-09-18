# One green Top-up button per service, with the exact links you gave

On Admin → Integrations, each service panel currently shows up to three buttons (Top up credits,
Open dashboard, Docs). That becomes a single green **Top up credits** button, and only for the
three services you named.

## The links

- Didit → https://business.didit.me/console/4d6e020e-3c38-469d-9386-5f2c12e2f41a/42f423bc-dfac-4f12-8dea-1cb51d0fc7a6
- Firecrawl → https://www.firecrawl.dev/pricing
- Resend → https://resend.com/settings/billing?product=transactional

## What is removed

- The "Open dashboard" button everywhere.
- The "Docs" button everywhere.
- Top-up links for every other service (Open Exchange Rates, PayFast, CIPC, SARS eFiling,
  AWS S3 / Glacier, escrow) — those panels show no link buttons at all.
- The fallback that turned a saved "Dev center login URL" into a Top-up button, so no unintended
  links appear.

Everything else on the panels stays exactly as it is: the fields, Save, Test connection, the
copy buttons for username and revealed credentials, and the plain-language failure messages.
The "Top up" action inside an out-of-credits message keeps working and uses the same three links.

## Technical notes

- `src/lib/integrations.catalog.ts`: set `topUpUrl` to the three addresses above for `didit`,
  `firecrawl` and `resend`; remove `topUpUrl` and `consoleUrl` from all other providers.
  The `consoleUrl` field itself is left on the type but unused.
- `src/components/admin/IntegrationsTab.tsx`: in the button block (lines ~426-452) render only
  `provider.topUpUrl` — drop the `devUrl` fallback, the dashboard button and the Docs button.
  Style it with the existing green token: `className="bg-success text-success-foreground
  hover:bg-success/90"` (no hardcoded colours). In `showFailure`, drop the `dev_center_url`
  fallback so the toast action only appears when `provider.topUpUrl` exists.
- The "Where to find these in the … portal" text link inside the setup checklist stays; it is
  not a button.
