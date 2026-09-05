-- Demo data: incoming bids/offers from other organisations, addressed to each of
-- georgia.adams@smartify.co.za's own organisations as counterparty, so the Inbox
-- ("transactions where your organisation sits on the other side of the table")
-- has realistic activity to review.

DO $$
DECLARE
  v_user_id uuid;
  v_izenzo uuid;
  v_kalahari uuid;
  v_nile uuid;
  v_cascadia uuid;
  v_cp uuid;
  v_tx uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'georgia.adams@smartify.co.za' LIMIT 1;
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT id INTO v_izenzo FROM public.organisations WHERE name = 'Izenzo Commodities (Pty) Ltd' LIMIT 1;
  SELECT id INTO v_kalahari FROM public.organisations WHERE name = 'Kalahari AgriTrade (Pty) Ltd' LIMIT 1;
  SELECT id INTO v_nile FROM public.organisations WHERE name = 'Nile Delta Energy Partners' LIMIT 1;
  SELECT id INTO v_cascadia FROM public.organisations WHERE name = 'Cascadia Timber & Pulp Ltd' LIMIT 1;

  -- Helper counterparty organisations (created if they don't already exist).
  -- Izenzo Commodities counterparties
  SELECT id INTO v_cp FROM public.organisations WHERE name = 'Meridian Metals SA' LIMIT 1;
  IF v_cp IS NULL THEN
    INSERT INTO public.organisations (name, registration_no, country, sector, credits)
    VALUES ('Meridian Metals SA', 'CH-020.3.045.678-9', 'Switzerland', 'Metals trading house', 40)
    RETURNING id INTO v_cp;
  END IF;
  IF v_izenzo IS NOT NULL THEN
    INSERT INTO public.transactions (org_id, counterparty_org_id, title, commodity, quantity, unit, price, currency, incoterms, jurisdiction, stage, step, created_by)
    VALUES (v_cp, v_izenzo, 'Copper cathode Q4 offer', 'Copper cathode Grade A', 1000, 'tonnes', 9650, 'USD', 'CIF', 'Switzerland', 'trading', 'bid-offer', v_user_id)
    RETURNING id INTO v_tx;
    INSERT INTO public.bid_offers (transaction_id, direction, price, quantity, unit, currency, terms, submitted_by)
    VALUES (v_tx, 'offer', 9650, 1000, 'tonnes', 'USD', 'Payment: LC at sight. Delivery: 30 days from LC confirmation.', v_user_id);
    INSERT INTO public.transaction_events (transaction_id, actor_id, actor_name, stage, step, action, summary)
    VALUES (v_tx, v_user_id, 'Meridian Metals SA', 'trading', 'bid-offer', 'offer_placed', 'Offer at 9650 USD');

    INSERT INTO public.transactions (org_id, counterparty_org_id, title, commodity, quantity, unit, price, currency, incoterms, jurisdiction, stage, step, created_by)
    VALUES (v_cp, v_izenzo, 'Cobalt hydroxide counter-bid', 'Cobalt hydroxide 32% Co', 250, 'tonnes', 13200, 'USD', 'FOB', 'Switzerland', 'trading', 'bid-offer', v_user_id)
    RETURNING id INTO v_tx;
    INSERT INTO public.bid_offers (transaction_id, direction, price, quantity, unit, currency, terms, submitted_by)
    VALUES (v_tx, 'counter', 13200, 250, 'tonnes', 'USD', 'Payment: 20% deposit, balance against BL. Delivery: ex-warehouse Durban.', v_user_id);
    INSERT INTO public.transaction_events (transaction_id, actor_id, actor_name, stage, step, action, summary)
    VALUES (v_tx, v_user_id, 'Meridian Metals SA', 'trading', 'bid-offer', 'bid_placed', 'Counter-bid at 13200 USD');
  END IF;

  SELECT id INTO v_cp FROM public.organisations WHERE name = 'Andes Copper Traders SpA' LIMIT 1;
  IF v_cp IS NULL THEN
    INSERT INTO public.organisations (name, registration_no, country, sector, credits)
    VALUES ('Andes Copper Traders SpA', 'CL-76.234.567-8', 'Chile', 'Base metals trading', 18)
    RETURNING id INTO v_cp;
  END IF;
  IF v_izenzo IS NOT NULL THEN
    INSERT INTO public.transactions (org_id, counterparty_org_id, title, commodity, quantity, unit, price, currency, incoterms, jurisdiction, stage, step, created_by)
    VALUES (v_cp, v_izenzo, 'Vanadium pentoxide bid', 'Vanadium pentoxide 98%', 60, 'tonnes', 8100, 'USD', 'CFR', 'Chile', 'trading', 'bid-offer', v_user_id)
    RETURNING id INTO v_tx;
    INSERT INTO public.bid_offers (transaction_id, direction, price, quantity, unit, currency, terms, submitted_by)
    VALUES (v_tx, 'bid', 8100, 60, 'tonnes', 'USD', 'Payment: 100% against documents. Delivery: within 45 days.', v_user_id);
    INSERT INTO public.transaction_events (transaction_id, actor_id, actor_name, stage, step, action, summary)
    VALUES (v_tx, v_user_id, 'Andes Copper Traders SpA', 'trading', 'bid-offer', 'bid_placed', 'Bid at 8100 USD');
  END IF;

  -- Kalahari AgriTrade counterparties
  SELECT id INTO v_cp FROM public.organisations WHERE name = 'Nordic AgriExports AB' LIMIT 1;
  IF v_cp IS NULL THEN
    INSERT INTO public.organisations (name, registration_no, country, sector, credits)
    VALUES ('Nordic AgriExports AB', 'SE-556677-8899', 'Sweden', 'Agricultural commodities', 22)
    RETURNING id INTO v_cp;
  END IF;
  IF v_kalahari IS NOT NULL THEN
    INSERT INTO public.transactions (org_id, counterparty_org_id, title, commodity, quantity, unit, price, currency, incoterms, jurisdiction, stage, step, created_by)
    VALUES (v_cp, v_kalahari, 'Sunflower oil offer', 'Crude sunflower oil', 500, 'tonnes', 980, 'USD', 'CIF', 'Sweden', 'trading', 'bid-offer', v_user_id)
    RETURNING id INTO v_tx;
    INSERT INTO public.bid_offers (transaction_id, direction, price, quantity, unit, currency, terms, submitted_by)
    VALUES (v_tx, 'offer', 980, 500, 'tonnes', 'USD', 'Payment: LC 60 days. Delivery: two shipments over Q1.', v_user_id);
    INSERT INTO public.transaction_events (transaction_id, actor_id, actor_name, stage, step, action, summary)
    VALUES (v_tx, v_user_id, 'Nordic AgriExports AB', 'trading', 'bid-offer', 'offer_placed', 'Offer at 980 USD');
  END IF;

  SELECT id INTO v_cp FROM public.organisations WHERE name = 'Sahel Grain Partners' LIMIT 1;
  IF v_cp IS NULL THEN
    INSERT INTO public.organisations (name, registration_no, country, sector, credits)
    VALUES ('Sahel Grain Partners', 'SN-2021-B-04512', 'Senegal', 'Grain trading', 9)
    RETURNING id INTO v_cp;
  END IF;
  IF v_kalahari IS NOT NULL THEN
    INSERT INTO public.transactions (org_id, counterparty_org_id, title, commodity, quantity, unit, price, currency, incoterms, jurisdiction, stage, step, created_by)
    VALUES (v_cp, v_kalahari, 'White maize counter-bid', 'White maize, grade 1', 2000, 'tonnes', 265, 'USD', 'FOB', 'Senegal', 'trading', 'bid-offer', v_user_id)
    RETURNING id INTO v_tx;
    INSERT INTO public.bid_offers (transaction_id, direction, price, quantity, unit, currency, terms, submitted_by)
    VALUES (v_tx, 'counter', 265, 2000, 'tonnes', 'USD', 'Payment: 30% advance, 70% against shipping docs. Delivery: 21 days.', v_user_id);
    INSERT INTO public.transaction_events (transaction_id, actor_id, actor_name, stage, step, action, summary)
    VALUES (v_tx, v_user_id, 'Sahel Grain Partners', 'trading', 'bid-offer', 'bid_placed', 'Counter-bid at 265 USD');
  END IF;

  -- Nile Delta Energy Partners counterparties
  SELECT id INTO v_cp FROM public.organisations WHERE name = 'Gulf Petrochemicals FZE' LIMIT 1;
  IF v_cp IS NULL THEN
    INSERT INTO public.organisations (name, registration_no, country, sector, credits)
    VALUES ('Gulf Petrochemicals FZE', 'AE-DXB-778899', 'United Arab Emirates', 'Petrochemicals', 35)
    RETURNING id INTO v_cp;
  END IF;
  IF v_nile IS NOT NULL THEN
    INSERT INTO public.transactions (org_id, counterparty_org_id, title, commodity, quantity, unit, price, currency, incoterms, jurisdiction, stage, step, created_by)
    VALUES (v_cp, v_nile, 'Polypropylene resin offer', 'Polypropylene homopolymer', 800, 'tonnes', 1120, 'USD', 'CFR', 'UAE', 'trading', 'bid-offer', v_user_id)
    RETURNING id INTO v_tx;
    INSERT INTO public.bid_offers (transaction_id, direction, price, quantity, unit, currency, terms, submitted_by)
    VALUES (v_tx, 'offer', 1120, 800, 'tonnes', 'USD', 'Payment: LC at sight. Delivery: 4 weeks from LC.', v_user_id);
    INSERT INTO public.transaction_events (transaction_id, actor_id, actor_name, stage, step, action, summary)
    VALUES (v_tx, v_user_id, 'Gulf Petrochemicals FZE', 'trading', 'bid-offer', 'offer_placed', 'Offer at 1120 USD');
  END IF;

  SELECT id INTO v_cp FROM public.organisations WHERE name = 'Levant Energy Traders' LIMIT 1;
  IF v_cp IS NULL THEN
    INSERT INTO public.organisations (name, registration_no, country, sector, credits)
    VALUES ('Levant Energy Traders', 'JO-2019-4471', 'Jordan', 'Energy trading', 14)
    RETURNING id INTO v_cp;
  END IF;
  IF v_nile IS NOT NULL THEN
    INSERT INTO public.transactions (org_id, counterparty_org_id, title, commodity, quantity, unit, price, currency, incoterms, jurisdiction, stage, step, created_by)
    VALUES (v_cp, v_nile, 'LPG cargo bid', 'LPG, propane/butane mix', 5000, 'tonnes', 610, 'USD', 'FOB', 'Jordan', 'trading', 'bid-offer', v_user_id)
    RETURNING id INTO v_tx;
    INSERT INTO public.bid_offers (transaction_id, direction, price, quantity, unit, currency, terms, submitted_by)
    VALUES (v_tx, 'bid', 610, 5000, 'tonnes', 'USD', 'Payment: LC 30 days. Delivery: single cargo, laycan next month.', v_user_id);
    INSERT INTO public.transaction_events (transaction_id, actor_id, actor_name, stage, step, action, summary)
    VALUES (v_tx, v_user_id, 'Levant Energy Traders', 'trading', 'bid-offer', 'bid_placed', 'Bid at 610 USD');
  END IF;

  -- Cascadia Timber & Pulp counterparties
  SELECT id INTO v_cp FROM public.organisations WHERE name = 'Nordic Timber Exports AB' LIMIT 1;
  IF v_cp IS NULL THEN
    INSERT INTO public.organisations (name, registration_no, country, sector, credits)
    VALUES ('Nordic Timber Exports AB', 'SE-556123-4567', 'Sweden', 'Forestry & pulp products', 27)
    RETURNING id INTO v_cp;
  END IF;
  IF v_cascadia IS NOT NULL THEN
    INSERT INTO public.transactions (org_id, counterparty_org_id, title, commodity, quantity, unit, price, currency, incoterms, jurisdiction, stage, step, created_by)
    VALUES (v_cp, v_cascadia, 'Softwood kraft pulp offer', 'Northern bleached softwood kraft pulp', 1200, 'tonnes', 850, 'USD', 'CIF', 'Sweden', 'trading', 'bid-offer', v_user_id)
    RETURNING id INTO v_tx;
    INSERT INTO public.bid_offers (transaction_id, direction, price, quantity, unit, currency, terms, submitted_by)
    VALUES (v_tx, 'offer', 850, 1200, 'tonnes', 'USD', 'Payment: LC 45 days. Delivery: monthly lots over Q1.', v_user_id);
    INSERT INTO public.transaction_events (transaction_id, actor_id, actor_name, stage, step, action, summary)
    VALUES (v_tx, v_user_id, 'Nordic Timber Exports AB', 'trading', 'bid-offer', 'offer_placed', 'Offer at 850 USD');
  END IF;

  SELECT id INTO v_cp FROM public.organisations WHERE name = 'Pacific Pulp Co' LIMIT 1;
  IF v_cp IS NULL THEN
    INSERT INTO public.organisations (name, registration_no, country, sector, credits)
    VALUES ('Pacific Pulp Co', 'US-91-2233445', 'United States', 'Pulp & paper', 11)
    RETURNING id INTO v_cp;
  END IF;
  IF v_cascadia IS NOT NULL THEN
    INSERT INTO public.transactions (org_id, counterparty_org_id, title, commodity, quantity, unit, price, currency, incoterms, jurisdiction, stage, step, created_by)
    VALUES (v_cp, v_cascadia, 'Sawn lumber counter-bid', 'SPF dimensional lumber', 3000, 'board feet (000s)', 410, 'USD', 'DAP', 'United States', 'trading', 'bid-offer', v_user_id)
    RETURNING id INTO v_tx;
    INSERT INTO public.bid_offers (transaction_id, direction, price, quantity, unit, currency, terms, submitted_by)
    VALUES (v_tx, 'counter', 410, 3000, 'board feet (000s)', 'USD', 'Payment: net 30. Delivery: rail, 3 weeks.', v_user_id);
    INSERT INTO public.transaction_events (transaction_id, actor_id, actor_name, stage, step, action, summary)
    VALUES (v_tx, v_user_id, 'Pacific Pulp Co', 'trading', 'bid-offer', 'bid_placed', 'Counter-bid at 410 USD');
  END IF;
END $$;
