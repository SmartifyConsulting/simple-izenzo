# BID9140055 test verification + map label consistency

## 1. Mark BID9140055 as verified on both sides (test data only)
- Set Izenzo's existing KYC and KYB checks on this deal (currently "In progress") to **Passed**, dated now.
- Add Passed KYC and KYB records for Holarc Health (Pty) Ltd on the same deal, so both cards show "Both verified".
- Payment of the 3 tokens is not touched; if a side hasn't paid, the paid section stays hidden until they do.

## 2. Map: Pre-feasibility and Feasibility match Concept and Bankability
- The two tiles currently use a fixed "open" look, which gives them a different text colour from Concept and Bankability.
- They will take the same state and styling as Concept, so all four tiles under Project Preparation / Bankability share the same font colour, size and weight in light and dark mode.
- Only Concept keeps its pulse when active (the other two won't pulse on their own).

## Technical details
- Data change (`supabase--run_sql`): `UPDATE identity_verifications SET status='passed', decision='approved', completed_at=now()` for ids `f73f495e…` and `4bfe9c24…`; `INSERT` two passed rows (`id_document`, `kyb`) with `transaction_id=d049ed4d…`, `subject_org_id=089084d6…`, `subject_label='Holarc Health (Pty) Ltd'`.
- `src/components/canvas/MapView.tsx` lines 816–817: replace `{ state: "open" }` with the state computed for the Concept node, minus the active pulse class.
