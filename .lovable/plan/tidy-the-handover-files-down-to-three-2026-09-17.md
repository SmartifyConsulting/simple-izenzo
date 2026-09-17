# Tidy the handover files down to three

Your Files folder has nine handover items from successive drafts. Only three should go to the client. The rest are superseded drafts and should be removed.

## What you keep

| File | Why |
|---|---|
| `Izenzo-Integration-Handover-v5.docx` | The full technical handover — the client's A–U items. To be reissued (see below). |
| `Izenzo-AIPlus-Build-Status-v2.docx` | The one-page AI+ status sheet. To be reissued (see below). |
| `Izenzo-Codebase-Handover-v3.zip` | The complete source code. To be rebuilt (see below). |

Three files, one purpose each: the explanation, the AI+ status, the code.

## What gets deleted

- `Izenzo-Integration-Handover.docx` — first draft, superseded
- `Izenzo-Integration-Handover-v3.docx` — superseded
- `Izenzo-Integration-Handover-v4.docx` — superseded by the reissue
- `Izenzo-Integration-Handover.md` — the working text behind the Word document, not a client deliverable
- `Izenzo-Codebase-Handover.zip` — superseded
- `Izenzo-Codebase-Handover-v2.zip` — superseded by the rebuild
- `Izenzo-Handover-Files.zip` — an early partial bundle, contents now inside the full ZIP
- `Izenzo-Database-Types.ts` — already inside the ZIP; standing alone it just invites confusion
- `Izenzo-AIPlus-Build-Status.docx` — superseded by the reissue

## Yes, the documents do need updating

The AI+ connection is being built right now, which changes both documents:

- The AI+ status sheet's "not built" list shrinks to the two items that genuinely sit on their side: they must stand their service up, and they must confirm the response shape works against the real thing.
- The handover document gains a short "Switching AI+ on" page: the three values their team enters, where they enter them, and what happens when it is left off.

So the reissue is not cosmetic — it is the reason to reissue rather than just delete.

## Order of work

1. Finish the AI+ adapter (in progress).
2. Reissue both documents at v5 / v2, same Montserrat black-and-white styling, every page checked as an image.
3. Rebuild the ZIP as v3 with the adapter code and the updated `.env.example` inside; inspect the entry list and confirm no secrets.
4. Delete the nine superseded files, leaving exactly the three above.
