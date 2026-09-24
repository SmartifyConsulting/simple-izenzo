-- Backfills the missed "you've been matched" Inbox notification for BID9906076's counterparty
-- (Holarc Health), now that profiles.email is fixed. Self-contained — looks up the transaction and
-- chosen counterparty by reference rather than needing ids pasted in.
-- Run supabase/scripts/backfill_profile_emails.sql first if you haven't already.

do $$
declare
  v_tx_id uuid;
  v_tx_reference text;
  v_tx_title text;
  v_cp_id uuid;
  v_cp_name text;
  v_cp_email text;
  v_profile_id uuid;
  v_org_id uuid;
begin
  select id, reference, title into v_tx_id, v_tx_reference, v_tx_title
  from public.transactions where reference = 'BID9906076';

  if v_tx_id is null then
    raise notice 'No transaction with reference BID9906076 — nothing to backfill.';
    return;
  end if;

  select id, name, contact_email into v_cp_id, v_cp_name, v_cp_email
  from public.counterparties
  where transaction_id = v_tx_id and status = 'chosen'
  order by created_at desc
  limit 1;

  if v_cp_id is null then
    raise notice 'No chosen counterparty on BID9906076 — nothing to backfill.';
    return;
  end if;

  select id, org_id into v_profile_id, v_org_id
  from public.profiles
  where lower(email) = lower(v_cp_email);

  if v_profile_id is null then
    raise notice 'No profile matches counterparty contact email % — nothing to backfill.', v_cp_email;
    return;
  end if;

  if exists (
    select 1 from public.notifications
    where transaction_id = v_tx_id and user_id = v_profile_id
  ) then
    raise notice 'A notification for this transaction/user already exists — skipping.';
    return;
  end if;

  insert into public.notifications (user_id, org_id, transaction_id, title, body, claim_counterparty_id)
  values (
    v_profile_id,
    v_org_id,
    v_tx_id,
    v_tx_reference || ' — you''ve been matched to a live opportunity',
    v_cp_name || ' has been selected as a potential counterparty for ' || coalesce(v_tx_title, 'this deal') || '. Open the deal to see the full details and respond.',
    v_cp_id
  );

  raise notice 'Inserted notification for user % on transaction %.', v_profile_id, v_tx_id;
end $$;
