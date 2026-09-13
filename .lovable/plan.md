# Background screening results in view, a leaner Without a Doubt, and an AML switch

Four changes: screening findings are readable before you press Continue, Without a Doubt stops repeating what screening already did, KYB is presented as covering UBO and AML, and the separate sanctions / PEP check can be switched off from the admin screen.

## 1. See the screening findings before Continue

- When background screening comes back, each counterparty's findings open automatically instead of sitting behind a closed row, so the results are on screen above the Continue button.
- A short line above them reads how many checks returned, and the "Download PDF" link stays where it is.
- Rows can still be collapsed by hand; Continue still needs a party ticked.

## 2. Without a Doubt no longer repeats screening

- The checklist keeps only what a person actually decides: KYC, KYB (including UBO and AML) and Authority to act.
- The separate "Sanctions screening clear" and "PEP screening reviewed" lines are removed — they were the same AML result reported twice.
- Everything already returned by background screening in Step 1 is shown once, read-only, as "Already screened in Step 1" with the result per check, rather than being run again.
- The identity verification block with its per-check buttons and "Re-run all" stays at the top above Case notes, but only offers checks that have not already come back clear.
- Case notes, the token cost, and the clearance decision and certificate are unchanged.

## 3. KYB is described as covering UBO and AML

- The KYB line reads "KYB — entity, beneficial owners (UBO) and AML verified", and the standalone UBO line folds into it.
- The same wording is used in the screening findings and the verification panel so the three places agree.

## 4. Switch the sanctions / PEP check off from Admin

- Admin → Integrations → Didit gets an on/off switch: "Run the separate sanctions / PEP (AML) check". It ships **off**, since KYB already covers it.
- While it is off: no AML session is opened during background screening or at Without a Doubt, the check is not listed in the verification panel or on the account page, and nothing on the deal waits on it.
- Switching it back on restores it everywhere without any other change.
- The workflow ID field for it stays, so an existing setting is not lost.

## Technical notes

- `src/components/canvas/DealCanvas.tsx` — seed `expandedScreeningCos` from `screeningResults` so each counterparty's checks render expanded on arrival; keep the toggle behaviour.
- `src/components/steps/StepScreen.tsx` — rewrite `WAD_CHECKS` to `kyc`, `kyb`, `authority`; drop `sanctions`/`pep`/`ubo` entries and their `WAD_CHECK_SOURCE` mappings; render the earlier screening results as a read-only "Already screened in Step 1" list (from the existing `screened` state, which already reuses settled rows) rather than re-opening sessions; filter the `checks` prop passed to `VerificationPanel` to check types not already `matched`.
- `src/lib/integrations.catalog.ts` — add `type?: "text" | "switch"` to `IntegrationField` and a `{ key: "aml_enabled", type: "switch" }` field on the Didit provider; `src/components/admin/IntegrationsTab.tsx` renders switch fields with `Switch`, storing `"true"`/`"false"` in the provider config.
- `src/lib/didit.server.ts` — `loadDiditCreds` returns `amlEnabled = config["aml_enabled"] === "true"`; `createDiditSession` refuses an `aml` check when it is off.
- `src/lib/screening.functions.ts` — filter `aml` out of `DIDIT_CHECKS` when `amlEnabled` is false.
- New small server fn (in `src/lib/didit.functions.ts`) returning the enabled check types, used by `VerificationPanel`, `VerifyIdentityDialog` and `_authenticated.account.settings.tsx` to filter their `checks` lists.
- No database changes; the setting lives in the existing `integration_credentials` config.
