# API Keys into Admin, and a tidier sign-off window

Three changes, all to what you see on screen. Nothing about deals, compliance,
sealing or permissions in the database changes.

## 1. API Keys moves into Admin

- Remove the "API" item from the top menu and remove the stand-alone API page,
  so there is no way to reach it from the menu.
- Add "API Keys" as a tab alongside the other Admin tabs, showing the same
  screen as today: issue, suspend, reactivate, rotate and revoke keys, sandbox
  and live, with named commercial and compliance owners required for live keys.
- Administrators only. The Admin screen is already administrator-gated, and the
  five key operations are separately administrator-only inside the database, so
  an ordinary user can neither see the tab nor perform the actions. Nothing in
  the database is relaxed.

Note: this was done once before and has since come back — the menu item and the
stand-alone page are both present again. This time the page file is removed
outright rather than left in place.

## 2. A submit button on the UAT sign-off window

Today the "Sign & Confirm" button only appears once a recognised signer name has
been typed, so the window looks as though it has no way to submit.

- Show the submit button at all times, at the bottom of the sign form.
- Keep it disabled, with a short line of guidance, until a recognised signer
  name has been entered and the signature preview is ready — so a name that is
  not on the authorised list still cannot sign.
- Behaviour on submit is unchanged: it signs, generates the PDF, and switches
  the window to the signed state with the download button.

## 3. The paragraphs read normally

The wording at the top of the window, and in the signed PDF, is currently stored
as hard-broken half-sentences and each fragment is shown as its own paragraph,
which is why it reads as broken lines.

- Store the wording as two whole paragraphs instead of fragments.
- Show them as two normal paragraphs that wrap to the width of the window.
- In the PDF, wrap the same text to the page width so it reads as flowing
  paragraphs there too, rather than at the arbitrary break points it uses now.
- The words themselves stay exactly the same.

## Checks

- Signed in as an administrator: Admin shows the API Keys tab, and issuing,
  rotating and revoking a sandbox key still works.
- Signed in as an ordinary user: no API item in the menu and no reachable API
  page.
- The sign-off window: submit button visible from the start, disabled until a
  recognised name is entered, paragraphs reading normally; sign once and confirm
  the signed state and the downloaded PDF read correctly.
- Type check and build clean.

## Technical notes

Delete `src/routes/_authenticated.api.tsx` and the `{ to: "/api", label: "API" }`
entry in `MainHeader.tsx`; register `ApiKeysTab` in the `ADMIN_TABS` list in
`_authenticated.admin.tsx` behind the existing admin guard, with `ApiKeysTab.tsx`
itself reused unchanged including its `admin_api_*` calls. In
`uatSignoff.functions.ts`, change `DOCUMENT_INTRO` to whole-paragraph strings and
add a simple width-based word-wrap helper used by the PDF body loop. In
`UatSignoffDialog.tsx`, render the intro paragraphs directly and move the submit
button out of the `matched` block with a `disabled` condition. No migration, no
RLS change, no change to POI, WaD, Execution, Finality, AI/AI+ behaviour or auth.
