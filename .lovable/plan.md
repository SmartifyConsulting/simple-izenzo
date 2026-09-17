# Minimum delivery for the client's last request (payment protection)

Goal: give the client exactly what his integration pack asks for, and nothing
more, so the full source package and handover document stay with you until you
are paid.

## What his request actually asks of you

His pack's "Required first response" is one item: a slice of the generated
database type definitions — table, column and enum names only, no rows, no
credentials — covering:

- transactions, transaction_events, bid_offers
- wad_cases, compliance_cases, compliance_case_events
- execution_records, finality_records
- ai_proposals, ai_suggestions, ai_suggestion_events
- api_keys, api_request_logs
- organisations, org_members
- the stage and status enum lists used by those tables

Everything else in the pack is either his own service's work, or already built
and tested on this side (signed calls, strict reply checking, invocation and
retry records, safe fallback, 18 automated checks).

## What to produce

1. `Izenzo-Types-Slice-v1.ts` — only the groups listed above, copied from the
   existing generated type file, with a short header stating it is a structural
   extract, contains no data and no credentials, and is shared for the AI+
   interface only.
2. `Izenzo-AIPlus-Interface-Confirmation-v1.docx` — one short document, two
   pages at most: the interface is built and switched off, the three values it
   needs when his service is live, and confirmation that the advisory-only rules
   are enforced in the database. No schema listings, no deployment details, no
   environment names beyond the three AI+ ones, no file inventory.

## What is deliberately held back

- `Izenzo-Codebase-Handover-v4.zip` (full source, migrations, configuration)
- `Izenzo-Integration-Handover-v6.docx` (full technical handover)
- `Izenzo-AIPlus-Build-Status-v2.docx` (full build status)

These stay in your Files folder, undelivered, until payment. They are already
finished, so releasing them later is a single step and needs no rebuild.

## Checks before delivery

- Read the types slice line by line to confirm it holds no rows, no keys, no
  addresses and no organisation names.
- Convert every page of the confirmation document to an image and inspect it.
- Confirm the two new files sit alongside the three held-back files, so you can
  see plainly what has been shared and what has not.

## Notes

No application code, database rules, permissions or governance protections
change in this work. Nothing is deleted.

Still on your side: the stored exchange-rate setting with a key in its address
field should be re-entered and that key rotated; the AI+ interface stays off
until the client's service is live and the three values are entered.
