-- Lets a person choose a cursive font for their digital signature during sign-up (new Step 3),
-- rendered wherever their signature needs to be shown against a Legal Agreement.
alter table public.profiles
  add column if not exists signature_font text;
