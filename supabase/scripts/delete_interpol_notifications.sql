-- Deletes notifications tied to the INTERPOL Demonstrator org — either directly addressed to that
-- org, or attached to one of its trades (transaction_id), whichever way a given row happens to be
-- linked.

-- Preview first.
select n.id, n.title, n.body, n.org_id, n.transaction_id, n.created_at
from public.notifications n
where n.org_id = (select id from public.organisations where workflow_template_key = 'interpol_investigation')
   or n.transaction_id in (
     select id from public.transactions
     where org_id = (select id from public.organisations where workflow_template_key = 'interpol_investigation')
   );

delete from public.notifications
where org_id = (select id from public.organisations where workflow_template_key = 'interpol_investigation')
   or transaction_id in (
     select id from public.transactions
     where org_id = (select id from public.organisations where workflow_template_key = 'interpol_investigation')
   );
