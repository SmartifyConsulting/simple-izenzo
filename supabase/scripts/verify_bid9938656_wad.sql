-- Marks both parties as verified (KYC = id_document, KYB = kyb) on BID9938656, for testing purposes
-- only — this writes the exact same identity_verifications rows a real passed Didit check would,
-- so it satisfies Pre-Screening, the WaD gate's own KYC/KYB checks, and the "ID Number + AtA /
-- Proof of Address" verified badge all at once (they all read from this table).

do $$
declare
  v_tx_id uuid;
  v_bidder_org_id uuid;
  v_counterparty_org_id uuid;
  v_bidder_user_id uuid;
  v_counterparty_user_id uuid;
  v_check identity_check_type;
begin
  select id, org_id, counterparty_org_id into v_tx_id, v_bidder_org_id, v_counterparty_org_id
  from public.transactions where reference = 'BID9938656';

  if v_tx_id is null then
    raise notice 'No transaction with reference BID9938656.';
    return;
  end if;
  if v_counterparty_org_id is null then
    raise notice 'BID9938656 has no linked counterparty org yet — nothing to mark for their side.';
  end if;

  select user_id into v_bidder_user_id from public.org_members
    where org_id = v_bidder_org_id order by created_at asc limit 1;
  select user_id into v_counterparty_user_id from public.org_members
    where org_id = v_counterparty_org_id order by created_at asc limit 1;

  foreach v_check in array array['id_document', 'kyb']::identity_check_type[] loop
    if v_bidder_user_id is not null then
      if exists (
        select 1 from public.identity_verifications
        where transaction_id = v_tx_id and check_type = v_check and subject_user_id = v_bidder_user_id
      ) then
        update public.identity_verifications
        set status = 'passed', decision = 'approved', completed_at = now(), updated_at = now()
        where transaction_id = v_tx_id and check_type = v_check and subject_user_id = v_bidder_user_id;
      else
        insert into public.identity_verifications (
          check_type, status, decision, provider, transaction_id, subject_user_id, subject_org_id,
          subject_label, completed_at
        ) values (
          v_check, 'passed', 'approved', 'manual', v_tx_id, v_bidder_user_id, v_bidder_org_id,
          'Bidder (test override)', now()
        );
      end if;
    end if;

    if v_counterparty_user_id is not null then
      if exists (
        select 1 from public.identity_verifications
        where transaction_id = v_tx_id and check_type = v_check and subject_user_id = v_counterparty_user_id
      ) then
        update public.identity_verifications
        set status = 'passed', decision = 'approved', completed_at = now(), updated_at = now()
        where transaction_id = v_tx_id and check_type = v_check and subject_user_id = v_counterparty_user_id;
      else
        insert into public.identity_verifications (
          check_type, status, decision, provider, transaction_id, subject_user_id, subject_org_id,
          subject_label, completed_at
        ) values (
          v_check, 'passed', 'approved', 'manual', v_tx_id, v_counterparty_user_id, v_counterparty_org_id,
          'Counterparty (test override)', now()
        );
      end if;
    end if;
  end loop;

  raise notice 'Marked KYC/KYB passed for both parties on BID9938656 (tx %).', v_tx_id;
end $$;
