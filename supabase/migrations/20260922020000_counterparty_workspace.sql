-- Counterparty workspace: lets the counterparty a bidder has chosen link their own registered
-- Izenzo organisation to that specific transaction (transactions.counterparty_org_id — the column
-- already existed, nothing ever wrote to it) and see a restricted view of the same workspace:
-- Bid Registration, Bid Information, and everything from Proof of Intent onward. Search, Choice
-- and Online Media stay bidder-only — these policies never grant write access to any of that.
--
-- Every policy below is additive (a new permissive policy alongside whatever already exists), so
-- existing bidder-side access is never touched.

alter table public.counterparties
  add column if not exists counterparty_response text check (counterparty_response in ('accepted', 'declined')),
  add column if not exists counterparty_responded_at timestamptz;

comment on column public.counterparties.counterparty_response is
  'Set by the counterparty org itself, once linked: accepted or declined. Declining before POI is sealed is an opt-out, per policy — it never overwrites an already-sealed deal.';

drop policy if exists "counterparty org reads matched transaction" on public.transactions;
create policy "counterparty org reads matched transaction"
  on public.transactions for select
  to authenticated
  using (
    counterparty_org_id is not null
    and exists (
      select 1 from public.org_members om
      where om.user_id = auth.uid() and om.org_id = transactions.counterparty_org_id
    )
  );

drop policy if exists "counterparty org reads matched bid_offers" on public.bid_offers;
create policy "counterparty org reads matched bid_offers"
  on public.bid_offers for select
  to authenticated
  using (
    exists (
      select 1 from public.transactions t
      join public.org_members om on om.org_id = t.counterparty_org_id
      where t.id = bid_offers.transaction_id and om.user_id = auth.uid()
    )
  );

drop policy if exists "counterparty org reads matched documents" on public.documents;
create policy "counterparty org reads matched documents"
  on public.documents for select
  to authenticated
  using (
    exists (
      select 1 from public.transactions t
      join public.org_members om on om.org_id = t.counterparty_org_id
      where t.id = documents.transaction_id and om.user_id = auth.uid()
    )
  );

drop policy if exists "counterparty org reads matched events" on public.transaction_events;
create policy "counterparty org reads matched events"
  on public.transaction_events for select
  to authenticated
  using (
    exists (
      select 1 from public.transactions t
      join public.org_members om on om.org_id = t.counterparty_org_id
      where t.id = transaction_events.transaction_id and om.user_id = auth.uid()
    )
  );

drop policy if exists "counterparty org reads matched wad" on public.wad_cases;
create policy "counterparty org reads matched wad"
  on public.wad_cases for select
  to authenticated
  using (
    exists (
      select 1 from public.transactions t
      join public.org_members om on om.org_id = t.counterparty_org_id
      where t.id = wad_cases.transaction_id and om.user_id = auth.uid()
    )
  );

drop policy if exists "counterparty org reads matched execution" on public.execution_records;
create policy "counterparty org reads matched execution"
  on public.execution_records for select
  to authenticated
  using (
    exists (
      select 1 from public.transactions t
      join public.org_members om on om.org_id = t.counterparty_org_id
      where t.id = execution_records.transaction_id and om.user_id = auth.uid()
    )
  );

drop policy if exists "counterparty org reads matched finality" on public.finality_records;
create policy "counterparty org reads matched finality"
  on public.finality_records for select
  to authenticated
  using (
    exists (
      select 1 from public.transactions t
      join public.org_members om on om.org_id = t.counterparty_org_id
      where t.id = finality_records.transaction_id and om.user_id = auth.uid()
    )
  );

drop policy if exists "counterparty org reads its own counterparty row" on public.counterparties;
create policy "counterparty org reads its own counterparty row"
  on public.counterparties for select
  to authenticated
  using (
    exists (
      select 1 from public.transactions t
      join public.org_members om on om.org_id = t.counterparty_org_id
      where t.id = counterparties.transaction_id and om.user_id = auth.uid()
    )
  );

-- The counterparty org may record its own accept/decline only on the row that actually names it
-- (status = 'chosen' on their own linked transaction) — never on any other candidate, never on a
-- transaction they aren't linked to.
drop policy if exists "counterparty org responds on its own row" on public.counterparties;
create policy "counterparty org responds on its own row"
  on public.counterparties for update
  to authenticated
  using (
    status = 'chosen'
    and exists (
      select 1 from public.transactions t
      join public.org_members om on om.org_id = t.counterparty_org_id
      where t.id = counterparties.transaction_id and om.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.transactions t
      join public.org_members om on om.org_id = t.counterparty_org_id
      where t.id = counterparties.transaction_id and om.user_id = auth.uid()
    )
  );
