-- Two separate data-quality backfills for existing profiles, both safe to re-run (no-ops once fixed):
--
-- 1. email: SignUpForm.tsx's profile upsert omitted `email` until just now, so any account created
--    before this fix has profiles.email = null even though auth.users.email is set correctly.
-- 2. full_name / last_name: the same upsert also wrote the whole "First Last" string into
--    full_name and never touched last_name at all — this splits any full_name that still looks
--    like "First Last" (exactly two words, last_name still empty) back into the two columns.
--    Anyone with a single-word name, or more than two words, is left untouched rather than guessed
--    at wrongly.

-- Preview both issues before changing anything.
select id, email as profile_email, full_name, last_name
from public.profiles
where email is null
   or (last_name is null and full_name ~ '^\S+\s+\S+$');

update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id
  and p.email is null
  and u.email is not null;

update public.profiles
set
  full_name = split_part(full_name, ' ', 1),
  last_name = split_part(full_name, ' ', 2)
where last_name is null
  and full_name ~ '^\S+\s+\S+$';
