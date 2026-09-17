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

## Appendix C — checked, and not yet fully matched

Appendix C in his pack is the exact calling code his service expects. Comparing
it with what was built here, four things differ:

| Item | His Appendix C | Built here |
| --- | --- | --- |
| Address ending | `/internal/v1/decision-packs` | `/v1/decision` |
| Stamped time | `X-Izenzo-Timestamp` sent | not sent |
| One-off number | `X-Izenzo-Nonce` sent | not sent |
| What is signed | time, one-off number and body together | body only |

Header spellings also differ slightly (`Key-ID` vs `Key-Id`, `X-Correlation-ID`
vs `X-Izenzo-Correlation-Id`), and his example gives up after 8 seconds where
this waits 45.

As it stands his service would refuse our calls, so this must be aligned before
any live test. It is a contained change to the one server-side calling file plus
its automated checks — no change to governance, permissions, the workflow spine
or anything a person sees.

### Alignment step (add to the work above)

1. Send the two extra stamps on every call and sign time, one-off number and
   body together, exactly as his example does.
2. Use his address ending and his header spellings.
3. Keep the existing safe behaviour: bounded wait, strict reply checking, the
   same retry key for a repeated moment, invocation and failure records, and
   fallback to the current advice path when his service is unreachable.
4. Update the 18 automated checks to the corrected shape and confirm they pass;
   confirm the build and type check stay clean.
5. Note the corrected call shape in the confirmation document, so his team can
   see the two sides now agree.

Whether to do this before or after payment is your call: it is needed only for a
live connection, and the interface stays switched off either way.
