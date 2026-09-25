-- The Concept sub-step (Execution, Step 3) gets an AI-tailored planning questionnaire instead of
-- the generic "Record this step" notes field — questions generated once per deal, based on what's
-- actually being traded, with a shared (not per-side) answer for each.
alter table public.transactions
  add column if not exists concept_questions jsonb,
  add column if not exists concept_questions_generated_at timestamptz,
  add column if not exists concept_questions_error text,
  add column if not exists concept_answers jsonb not null default '{}'::jsonb;
