-- Multi-tenant invite flow: a shareable code per organisation that a colleague can enter to join
-- that org as a member, instead of every new sign-up always getting a brand-new organisation of
-- their own with no way for anyone else to join it.
alter table public.organisations
  add column if not exists invite_code text;

update public.organisations
set invite_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
where invite_code is null;

alter table public.organisations
  alter column invite_code set not null,
  alter column invite_code set default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

create unique index if not exists organisations_invite_code_key on public.organisations (invite_code);

-- org_members.role was an unconstrained free-text column with every existing row hardcoded to
-- "owner" (nothing ever read it) — constrain it now that "member" is a real, distinct value:
-- joining via an invite code creates a member, never an owner.
update public.org_members set role = 'owner' where role is null;

alter table public.org_members
  alter column role set default 'member',
  drop constraint if exists org_members_role_check,
  add constraint org_members_role_check check (role in ('owner', 'member'));

-- Deliberately no RLS change here: looking up an organisation by invite code, and joining it, both
-- go through service-role server functions (see src/lib/orgInvite.functions.ts) rather than a
-- direct client-side select — a signed-in user must never be able to read an organisation's row
-- (name, address, contact details, credits) just by querying the table, invite code or not. That
-- isolation is the whole point of multi-tenancy and must stay intact.
