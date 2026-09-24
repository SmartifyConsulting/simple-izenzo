-- SignUpForm.tsx's profile upsert omitted `email`, so any account created through that step has
-- profiles.email = null even though auth.users.email is set correctly. This backfills it from
-- auth.users for every affected row, and is safe to re-run (a no-op once fixed).

select p.id, p.email as profile_email, u.email as auth_email
from public.profiles p
join auth.users u on u.id = p.id
where p.email is null;

update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id
  and p.email is null
  and u.email is not null;
