-- Tracks how a counterparty's contact_email was actually obtained, so the bidder can see whether an
-- address came from the app itself (already on file, or a registered platform org's own contact),
-- their website (scraped), or is an unconfirmed AI guess at their domain.
alter table public.counterparties
  add column if not exists contact_email_source text
    check (contact_email_source in ('app', 'website', 'guessed'));
