# Let users create their own API keys, then reissue two handover files

Short answer: two of the three files need redoing, not all three.

- The handover document describes API keys as administrator-only, and that is changing — reissue as v6.
- The code package predates the new API screen and this change — rebuild as v4.
- The AI+ status sheet is untouched by this work — `Izenzo-AIPlus-Build-Status-v2.docx` stays as is.

## 1. Fix the permission rule in the database

The new API screen calls five database routines that still refuse anyone who
is not a platform administrator, so an ordinary user pressing "Create key"
gets a permission error today. Those routines will be replaced so that:

- Any signed-in user may create, suspend, reactivate, rotate and revoke keys
  **for their own organisation only**, in both sandbox and live.
- A user cannot touch another organisation's keys — the check is made in the
  database, so it holds even outside this screen.
- Administrators keep full access as before.
- The live-key rule stays: a named commercial owner and compliance owner are
  still required.
- Expiry, revocation reasons and the recorded "who did this" stay exactly as
  they are.

The Admin and Integrations screens remain administrator-only; nothing about
that changes.

## 2. Confirm reading is scoped the same way

Check that the rule controlling who can *see* keys also limits people to
their own organisation, and correct it if it does not. No other table's rules
are touched.

## 3. Check it end to end

Sign in as an ordinary (non-admin) user in the running app, create a sandbox
key, rotate it, revoke it, and confirm no other organisation's keys are
visible. Then confirm an administrator still sees and manages everything.

## 4. Reissue the two documents

- `Izenzo-Integration-Handover-v6.docx` — update the API-keys section to
  describe self-service key management and the own-organisation limit, note
  that the five routines are now in the tracked migrations, and refresh the
  companion-file list.
- `Izenzo-Codebase-Handover-v4.zip` — rebuild from the clean source so it
  contains the new API screen, the top-level API navigation, the new
  migration and the current example environment file (names only, no values).

Both are checked page by page as images, and the package contents listed to
confirm no keys, no build output and no dependency folders. The three older
files (v5 document, v3 package) are removed afterwards so the folder again
holds exactly three items.

## Technical notes

- One migration replaces `admin_api_create_key`, `admin_api_suspend_key`,
  `admin_api_reactivate_key`, `admin_api_revoke_key` and
  `admin_api_rotate_key` via `CREATE OR REPLACE FUNCTION`, swapping the
  `has_role(auth.uid(),'admin')` gate for `admin OR caller belongs to
  p_org_id` (via `org_members` / `profiles.org_id`), resolved from the key row
  for the id-only routines. Signatures, return types and `SECURITY DEFINER`
  stay unchanged, so `ApiKeysTab.tsx` needs no change.
- `api_keys` RLS/SELECT is verified to be org-scoped for `authenticated`.
- No change to POI, WaD, Execution, Finality, AI/AI+ behaviour, auth, or any
  other table or policy.

## Still on your side

- The stored exchange-rate setting with a key in a web-address field should be
  re-entered properly and that key rotated.
- Georgia's AI+ values (endpoint address, signing key ID, signing secret) once
  her service is live.
