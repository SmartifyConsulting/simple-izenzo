-- Confirms whether SeedAxis the ORGANISATION has its own contact_email/website on file — this is
-- the field the outreach email actually reads (organisations.primary_contact_email), which is a
-- completely separate column from any individual member's own sign-in email (profiles.email). A
-- real registered user like Hanish Gupta (hanish@seedaxis.co.za) does not mean this field is set.

select id, name, primary_contact_email, primary_contact_name, website
from public.organisations
where name ilike '%seedaxis%';

-- If primary_contact_email above is null, this backfills it from the earliest member of that org
-- (typically whoever registered it) — uncomment and run once you've confirmed the id above.

-- update public.organisations o
-- set primary_contact_email = coalesce(o.primary_contact_email, m.email)
-- from (
--   select om.org_id, p.email,
--          row_number() over (partition by om.org_id order by om.created_at asc) as rn
--   from public.org_members om
--   join public.profiles p on p.id = om.user_id and p.email is not null
--   where om.org_id = '<seedaxis org id from the select above>'
-- ) m
-- where o.id = m.org_id and m.rn = 1;
