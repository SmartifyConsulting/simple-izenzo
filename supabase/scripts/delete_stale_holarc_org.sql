-- Deletes the stale duplicate "Holarc Health (Pty) Ltd" org left over from wizard testing
-- (id acccb30b-a168-4ee7-bbd8-47ed32822903, contact wizardtest.20260924a@izenzo-test.com).
-- This is almost certainly what counterparty-outreach's name-matching found instead of the real
-- org (089084d6-dbea-4885-b423-2b1ed9ea181d, support@holarchealth.com), which is why the Inbox
-- notification silently missed its match while the email itself still sent.
-- Run the SELECT first to confirm it still has no members (safe to delete).

select o.id, o.name, o.primary_contact_email, count(m.user_id) as member_count
from public.organisations o
left join public.org_members m on m.org_id = o.id
where o.id = 'acccb30b-a168-4ee7-bbd8-47ed32822903'
group by o.id, o.name, o.primary_contact_email;

delete from public.organisations
where id = 'acccb30b-a168-4ee7-bbd8-47ed32822903'
  and not exists (
    select 1 from public.org_members where org_id = 'acccb30b-a168-4ee7-bbd8-47ed32822903'
  );
