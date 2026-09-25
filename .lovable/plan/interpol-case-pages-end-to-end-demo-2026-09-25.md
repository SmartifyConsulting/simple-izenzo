# INTERPOL case pages — end-to-end demo

Goal: Georgia (INTERPOL Demonstrator) can open each of the three demo cases (INV3217492 BEC, INV6684138 SIM swap, INV1404732 trafficking) and work them from starting evidence to closure, with the five Izenzo headings still visible.

## What the user will see

1. **Case page** (one screen per case, reached from the home list): case summary, starting evidence, and the five spine headings as sections.
2. **Evidence upload**: add multiple files with a note and source; each item is logged with who added it and when (chain of custody). Items can't be edited after logging, only added to.
3. **AI+ analysis**: button runs the analysis on the case plus its evidence. Returns suggested leads, each showing direction (backward / forward / lateral), reason, evidence basis, expected result, whether it strengthens or weakens the case, and authority needed. The investigator accepts or rejects each lead — attributed, timestamped, permanent. AI+ stays advisory.
4. **Freeze Intent + WaD checks**: investigator agency, mandate, jurisdiction, legal authority (warrant / subpoena / consent), chain of custody. Closure is blocked until all are ticked; a failed check is logged permanently in Memory.
5. **Case closure**: outcome (closed — actioned / closed — no further action / referred), a closing note, and an AI-drafted case summary. Closing can optionally open a follow-up cycle (the recursive loop) as a new linked case.

## Technical details

- New route `/_authenticated/case/$ref` with sections reusing existing StepScreen upload, AI+ rationale modal and RelabelScope.
- New migration: `case_evidence` (append-only, custody fields), `case_leads` (AI+ proposals + one-time human decision), `case_closures`; GRANTs + org RLS; triggers blocking update/delete and blocking closure while WaD is incomplete.
- Server function for AI+ analysis via Lovable AI Gateway (`openai/gpt-6-astra`, streamed, structured leads); reuses Tavily search for lateral leads.
- Home list links cases on the interpol template to the case page.

## Cost

Roughly 4–6 credits of the ~25 remaining. Browser check of one full case at the end.
