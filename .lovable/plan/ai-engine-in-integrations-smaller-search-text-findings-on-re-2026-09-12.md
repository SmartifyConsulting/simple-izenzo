# AI+ Engine in Integrations, smaller search text, findings on results

## 1. AI+ Engine listed under Integrations

Admin → Integrations gets a new **AI+ Engine** section with a single service, **Izenzo AI+**, alongside the other providers:

- Summary: the protected AI+ decision service that proposes candidates, pricing, risk flags and structure for a person to adopt or reject.
- Where it's used: the five moments named in the instructions — after a party is chosen, at Intent, after Proof of Intent is sealed, when a Without a Doubt case changes, and after Finality is recorded.
- Environments: sandbox and production, kept separate.
- Fields to fill in: private service address, signing key ID, signing secret (the last two hidden once saved). Values are encrypted and stored server-side only.
- A note on the panel stating AI+ only proposes — it never records a Choice, Intent, Proof of Intent, Without a Doubt, Execution or Finality outcome, and every proposal still needs a person to accept or reject it.

This step lists and stores the connection details. Actually calling the AI+ service at those five moments (mapping, proposal storage, accept/reject events, tests) is the follow-on build and is not part of this change.

## 2. Smaller text in the search bar

The description side of the split search ribbon uses a smaller text size, so a longer description fits without the ribbon growing. The drop side and the ribbon height stay as they are.

## 3. Results show the match and the findings

Each result — in the homepage preview and in the workspace list — shows, under the name:

- the sector, jurisdiction and how it was found, as now, and
- the short finding recorded for that match (why it fits / what was noted), plus a link to the page it was found on where one exists.

Rows with no finding recorded simply omit that line.

## Technical notes

- `src/lib/integrations.catalog.ts`: add `"AI+ Engine"` to `INTEGRATION_GROUPS` and an `izenzo_ai_plus` provider with fields `private_url` (secret, help naming `AI_PLUS_PRIVATE_URL`), `hmac_key_id` (secret), `hmac_secret` (secret), `environments: ["sandbox", "production"]`, `testable: false`, and a `testNote` covering the advisory-only governance boundary. No client-side import of any AI+ code.
- `src/components/marketing/HeroMatchCard.tsx`: prompt input `text-base` → `text-sm`; select `summary, source_url` in `useIllustrativeMatches` and render summary plus an external link. Apply the same `text-sm` change to the pop-up prompt in `src/components/guided/DocumentUploadStep.tsx` for consistency.
- `src/components/canvas/MatchResultsPanel.tsx`: it currently reads `counterparties`; extend its select with `rationale` (and `media_flags` evidence URL) and render those as the findings line, matching the hero card.
- No database, RLS or search-logic changes.
