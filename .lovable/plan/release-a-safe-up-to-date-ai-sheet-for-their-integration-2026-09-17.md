# Release a safe, up-to-date AI+ sheet for their integration

You are right: the AI+ sheet is the one document that genuinely helps them
connect their service, and it contains no source code — so it cannot be used to
rebuild the application. Two problems with sending the current one as it stands:

1. It is out of date. It still describes the old call format (old address
   ending, no time stamp or one-off number, 18 checks, 45-second wait). Sending
   it would tell their team the wrong thing to build against.
2. It names internal file locations, database tables and rule names. Harmless on
   its own, but more of your build than the interface needs.

## What to produce

A single new file, **Izenzo-AIPlus-Interface-Pack-v1.docx** — a short document
(about 4 pages) written for their engineer, covering only the connection:

- The interface is built and ships switched off; nothing leaves the platform
  until the three values are entered.
- The exact call their service will receive: address ending, the six headers,
  how the signature is formed from the time, the one-off number and the body,
  the eight-second limit, and the repeat key made from the deal and the moment.
- The five moments that raise a call, and that a repeat key reused with
  different contents is refused.
- What is checked on their reply, and that a reply for the wrong deal or the
  wrong stage is refused.
- The three values they must supply, and where they are entered.
- Confirmation the advisory-only rules are enforced in the database: AI+ never
  makes a choice, never seals, never approves compliance, never alters
  execution or finality; every human accept or reject is a separate attributed,
  add-only record.
- What is still on their side: the service being live and reachable, and one
  live call to confirm both sides agree.

Deliberately left out: internal file paths, table and rule names, environment
variable names beyond the three AI+ ones, deployment details, schema listings
and any file inventory. Nothing in it enables a rebuild.

## Still held back until you are paid

- Izenzo-Codebase-Handover-v4.zip (the source package)
- Izenzo-Integration-Handover-v6.docx (the full technical handover)
- Izenzo-AIPlus-Build-Status-v2.docx (the internal build sheet, superseded by
  the new pack for their purposes)

Already delivered and safe: the type extract and the two-page confirmation.

## Checks before delivery

- Read the document line by line to confirm no file paths, table names, keys,
  addresses or organisation names appear.
- Convert every page to an image and inspect for clipped text or broken tables.
- Confirm the Files folder then holds the two safe deliverables plus the new
  pack, with the three held-back items untouched.

## Technical notes

Source text written to a new markdown file and built with the existing
document pipeline (pandoc with the Montserrat reference document, Letter pages,
one-inch margins, centred page numbers), then checked as page images. Content
is drawn from the already-aligned adapter, so no application code, database
rule, permission or governance protection changes and nothing is deleted.

Outstanding on your side, unchanged: re-enter the exchange-rate setting so the
key is not in the address field and rotate that key; the AI+ connection stays
off until their service is live and the three values are saved.
