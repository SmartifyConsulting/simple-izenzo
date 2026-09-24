-- The org-name-scoped SELECT found nothing, which means either the signup never got far enough to
-- create an organisation row, or the name/email isn't exactly what we guessed. This casts a much
-- wider net across auth.users and profiles so we can see what's actually there, then pick the right
-- id to delete precisely.

select u.id as user_id, u.email, u.created_at, p.full_name, p.account_type, p.org_id, o.name as org_name
from auth.users u
left join public.profiles p on p.id = u.id
left join public.organisations o on o.id = p.org_id
where lower(u.email) like '%holarc%'
   or lower(coalesce(p.full_name, '')) like '%holarc%'
   or lower(coalesce(o.name, '')) like '%holarc%'
order by u.created_at desc;
