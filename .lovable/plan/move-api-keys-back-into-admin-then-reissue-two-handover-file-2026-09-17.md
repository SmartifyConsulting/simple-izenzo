# Move API Keys back into Admin, then reissue two handover files

Short answer on the documents: two of the three need redoing, not all three.

- The handover document should reflect where API keys now live — reissue as v6.
- The code package predates the API screen changes — rebuild as v4.
- The AI+ status sheet is untouched by this work — `Izenzo-AIPlus-Build-Status-v2.docx` stays as it is.

## 1. Remove API Keys from the main navigation

Take the top-level "API" item out of the header menu and remove the
stand-alone API page, so there is only one place to manage keys.

## 2. Put API Keys back in Admin as a tab

Add "API Keys" as a tab alongside the other Admin tabs, showing the same
screen that exists today: issue, suspend, reactivate, rotate and revoke keys,
sandbox and live, with the named commercial and compliance owners required for
live keys.

## 3. Keep the administrator restriction on

No database change at all. The five key routines keep their existing
administrator-only rule, which is exactly what the backend note describes —
so nothing needs relaxing in the SQL editor, and only administrators reach the
tab in the first place. Everything stays consistent between the screen and the
database.

## 4. Check it

Sign in as an administrator and confirm the Admin tab issues, rotates and
revokes a sandbox key. Sign in as an ordinary user and confirm there is no API
item in the menu and no reachable API page.

## 5. Reissue the two documents

- `Izenzo-Integration-Handover-v6.docx` — API keys described as an
  administrator-only Admin tab, with the database-side restriction stated
  plainly, and the companion-file list refreshed.
- `Izenzo-Codebase-Handover-v4.zip` — rebuilt from the clean source so it
  matches the final arrangement, with the example environment file listing
  variable names only, never values.

Both are checked page by page as images, and the package contents listed to
confirm no keys, no build output and no dependency folders. The superseded v5
document and v3 package are removed afterwards, so the folder again holds
exactly three items.

## Technical notes

- Delete `src/routes/_authenticated.api.tsx` and its nav entry in
  `MainHeader.tsx`; register `ApiKeysTab` as a tab in
  `_authenticated.admin.tsx` behind the existing admin guard.
- `ApiKeysTab.tsx` itself is reused unchanged, including its
  `admin_api_*` calls.
- No migration, no RLS change, no change to POI, WaD, Execution, Finality,
  AI/AI+ behaviour or auth.

## Still on your side

- The stored exchange-rate setting with a key in a web-address field should be
  re-entered properly and that key rotated.
- Georgia's AI+ values (endpoint address, signing key ID, signing secret) once
  her service is live.
