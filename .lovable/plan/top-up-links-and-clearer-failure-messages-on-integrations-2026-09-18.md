# Top-up links and clearer failure messages on Integrations

Two changes to the Admin → Integrations screen. Nothing about deals, gates, permissions or the database changes.

## 1. A link straight to each service's own top-up page

Each service card gets up to three small buttons at the top of its panel:

- **Top up credits** — opens that service's billing/credits page in a new tab.
- **Open dashboard** — opens the service's console, for services with no separate billing page.
- **Docs** — the existing documentation link, moved next to them.

Alongside those, the sign-in details already saved for that service (portal username and the
credentials field) get a small **Copy** button each, so the admin can paste them into the
provider's login page without revealing them on screen. The credentials value is only copyable
after it has been revealed with the vault password, exactly as today — nothing new is exposed.

Known top-up/console addresses are filled in for Firecrawl, Resend, Open Exchange Rates, Didit,
PayFast, ComplyAdvantage and AWS. For anything else, the admin can type the address into the
existing "Dev center login URL" field and the button uses that.

## 2. Meaningful messages when a service fails

Today a failed check shows the raw reply, e.g. `Rejected [402]: {"error":...}`. Each failure is
translated into a plain sentence naming the service and the fix, shown as a titled toast with a
short description. The rules:

- **No credits / out of balance (402, or a "credit"/"quota"/"insufficient" reply)** — "Firecrawl
  has run out of credits. Top up Firecrawl to continue." The toast carries a **Top up** action
  button that opens the same link as above.
- **Wrong or expired key (401/403)** — "Firecrawl refused the key. Re-enter the API key and save."
- **Too many requests (429)** — "Firecrawl is rate-limiting us. Wait a moment, or upgrade the plan."
- **Nothing saved yet** — "No details saved for Firecrawl yet. Fill the fields and press Save."
- **Service unreachable / timed out** — "Could not reach Firecrawl. The service may be down, or the
  address saved is wrong."
- **Anything else** — "Firecrawl rejected the request." with the provider's own wording underneath.

The same translation is applied wherever an integration failure already surfaces to a user (the
registry website lookup, online media screening, AI+ advice, email sending and card payment), so a
missing balance reads the same way everywhere instead of as a status code.

Successes stay as they are. The "Last checked" line on the card records the new wording too.

## Technical notes

- `src/lib/integrations.catalog.ts`: add optional `topUpUrl` and `consoleUrl` to
  `IntegrationProvider` and populate them for the providers above.
- `src/lib/integrations.functions.ts`: add a `classifyFailure(providerId, status, body)` helper and
  route every `probe()` branch's non-OK path through it, returning
  `{ ok: false, message, reason }` where `reason` is one of `no_credits | bad_key | rate_limited |
  not_configured | unreachable | rejected`. `TestResult` gains the optional `reason` and an
  optional `topUpUrl`. Stored `last_test_message` keeps the human sentence.
- `src/components/admin/IntegrationsTab.tsx`: render the link buttons and copy buttons; show
  `toast.error(title, { description, action })` with the **Top up** action when
  `reason === "no_credits"` and a URL is known.
- Shared helper reused by the other call sites (`firecrawl.server.ts`, `resend.server.ts`,
  `payfast.server.ts`, `webLookup.functions.ts`, `decisionPack.functions.ts`) so their thrown
  messages carry the same wording. No change to their control flow or fallbacks.
- Untouched: governance triggers, RLS, encryption of stored secrets, the vault-password reveal gate,
  and the AI+ advisory-only behaviour.
