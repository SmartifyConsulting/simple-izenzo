# Name the engine "Izenzo AI+" everywhere

Use "Izenzo AI+" as the single name for the engine in the app. Right now the Integrations page groups it under the heading "AI+ Engine" while the entry inside is called "Izenzo AI+" — the same thing named twice.

## What changes

- The Integrations section heading becomes "Izenzo AI+" instead of "AI+ Engine".
- The entry inside that section keeps its details (private address, signing key ID, signing secret) and its note that it only proposes, never records outcomes.
- Wording that describes the engine in that section reads "Izenzo AI+", not "the AI+ Engine".

## Left alone

- "Live Deal Engine", "Engine Map", and "Compliance Engine" are different things and keep their names.
- The AI+ search tier button label stays as it is.

## Technical detail

In `src/lib/integrations.catalog.ts`: rename the `INTEGRATION_GROUPS` entry `"AI+ Engine"` to `"Izenzo AI+"` and update the `group` field on the `izenzo_ai_plus` provider to match. No database, secret, or saved-credential changes; group names are display-only, so nothing stored is affected.
