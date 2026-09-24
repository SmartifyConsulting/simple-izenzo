-- Backs the "Verified" badge shown next to a person's name: true only once the AI document check
-- (run from AuthorityToActPanel's Save button) has confirmed the registration document plausibly
-- belongs to them. Never a substitute for the real KYC/KYB/AML check at the Without a Doubt gate —
-- this is a lightweight sanity check that the right file was attached at registration.
alter table public.profiles
  add column if not exists identity_verified boolean not null default false,
  add column if not exists identity_verified_reason text;
