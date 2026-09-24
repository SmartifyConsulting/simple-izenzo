-- Marks both parties as verified (KYC = id_document, KYB = kyb) on BID9938656, for testing purposes
-- only. Writes to BOTH tables the real flow touches:
--   identity_verifications — what the KYC/KYB two-column boxes, Pre-Screening, and the
--     "ID Number + AtA / Proof of Address" verified badge all read.
--   engagement_diligence — what actually decides "bothCleared" and triggers WaD's own
--     auto-complete (and, now, the Continue button). Skipping this table is why an earlier version
--     of this script left the Continue button never appearing — identity_verifications alone was
--     never enough to satisfy bothCleared.

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
          'Bidder', now()
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
          'Counterparty', now()
        );
      end if;
    end if;
  end loop;

  -- engagement_diligence has one row per reviewer_side (not per check), covering both kyc_state
  -- and kyb_state together.
  if exists (select 1 from public.engagement_diligence where transaction_id = v_tx_id and reviewer_side = 'bidder') then
    update public.engagement_diligence set kyc_state = 'passed', kyb_state = 'passed', updated_by = v_bidder_user_id
    where transaction_id = v_tx_id and reviewer_side = 'bidder';
  else
    insert into public.engagement_diligence (transaction_id, reviewer_side, kyc_state, kyb_state, updated_by)
    values (v_tx_id, 'bidder', 'passed', 'passed', v_bidder_user_id);
  end if;

  if exists (select 1 from public.engagement_diligence where transaction_id = v_tx_id and reviewer_side = 'counterparty') then
    update public.engagement_diligence set kyc_state = 'passed', kyb_state = 'passed', updated_by = v_counterparty_user_id
    where transaction_id = v_tx_id and reviewer_side = 'counterparty';
  else
    insert into public.engagement_diligence (transaction_id, reviewer_side, kyc_state, kyb_state, updated_by)
    values (v_tx_id, 'counterparty', 'passed', 'passed', v_counterparty_user_id);
  end if;

  raise notice 'Marked KYC/KYB passed for both parties on BID9938656 (tx %) — bothCleared should now be true.', v_tx_id;
end $$;
