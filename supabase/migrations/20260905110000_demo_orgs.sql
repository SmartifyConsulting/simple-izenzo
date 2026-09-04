-- Demo data: attach 4 organisations to the current demo user (georgia.adams@smartify.co.za)
-- with realistic details and several months of token ledger activity, for a richer demo.
DO $$
DECLARE
  v_user_id uuid;
  v_org_1 uuid;
  v_org_2 uuid;
  v_org_3 uuid;
  v_org_4 uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'georgia.adams@smartify.co.za' LIMIT 1;
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  -- 1. Izenzo Commodities (Pty) Ltd — South Africa, likely already exists as the active org.
  SELECT id INTO v_org_1 FROM public.organisations WHERE name = 'Izenzo Commodities (Pty) Ltd' LIMIT 1;
  IF v_org_1 IS NULL THEN
    INSERT INTO public.organisations (name, registration_no, country, sector, address, credits, offerings, website)
    VALUES (
      'Izenzo Commodities (Pty) Ltd', '2018/331720/07', 'South Africa', 'Metals & minerals trading',
      '4 Sandown Valley Crescent, Sandton, 2196', 24,
      'Base and battery metals — copper cathode, cobalt hydroxide, vanadium pentoxide. FOB and CIF terms, 500–5,000t lot sizes.',
      'https://izenzo.co.za'
    )
    RETURNING id INTO v_org_1;
  END IF;
  INSERT INTO public.org_members (org_id, user_id, role)
  VALUES (v_org_1, v_user_id, 'owner') ON CONFLICT DO NOTHING;

  -- 2. Kalahari AgriTrade (Pty) Ltd — Botswana
  SELECT id INTO v_org_2 FROM public.organisations WHERE name = 'Kalahari AgriTrade (Pty) Ltd' LIMIT 1;
  IF v_org_2 IS NULL THEN
    INSERT INTO public.organisations (name, registration_no, country, sector, address, credits, offerings, website)
    VALUES (
      'Kalahari AgriTrade (Pty) Ltd', 'BW00219876', 'Botswana', 'Agricultural commodities',
      'Plot 5401, Gaborone International Finance Park, Gaborone', 12,
      'Decorticated hemp fibre, sorghum, sunflower seed. Bale-pressed and bulk bagging, regional road and rail logistics.',
      'https://kalahariagritrade.example'
    )
    RETURNING id INTO v_org_2;
  END IF;
  INSERT INTO public.org_members (org_id, user_id, role)
  VALUES (v_org_2, v_user_id, 'owner') ON CONFLICT DO NOTHING;

  -- 3. Nile Delta Energy Partners — Egypt
  SELECT id INTO v_org_3 FROM public.organisations WHERE name = 'Nile Delta Energy Partners' LIMIT 1;
  IF v_org_3 IS NULL THEN
    INSERT INTO public.organisations (name, registration_no, country, sector, address, credits, offerings, website)
    VALUES (
      'Nile Delta Energy Partners', 'EG-CR-778341', 'Egypt', 'Energy & petrochemicals',
      '12 Corniche El Nil, Maadi, Cairo', 40,
      'Refined petroleum products, LPG and naphtha. Term and spot cargoes, Suez and Alexandria loadports.',
      'https://nildeltaenergy.example'
    )
    RETURNING id INTO v_org_3;
  END IF;
  INSERT INTO public.org_members (org_id, user_id, role)
  VALUES (v_org_3, v_user_id, 'owner') ON CONFLICT DO NOTHING;

  -- 4. Cascadia Timber & Pulp Ltd — Canada
  SELECT id INTO v_org_4 FROM public.organisations WHERE name = 'Cascadia Timber & Pulp Ltd' LIMIT 1;
  IF v_org_4 IS NULL THEN
    INSERT INTO public.organisations (name, registration_no, country, sector, address, credits, offerings, website)
    VALUES (
      'Cascadia Timber & Pulp Ltd', 'CA-BC-0044219', 'Canada', 'Forestry & pulp products',
      '900 West Georgia Street, Vancouver, BC', 6,
      'Softwood lumber, kraft pulp and wood chips. FSC-certified supply, container and breakbulk shipments.',
      'https://cascadiatimber.example'
    )
    RETURNING id INTO v_org_4;
  END IF;
  INSERT INTO public.org_members (org_id, user_id, role)
  VALUES (v_org_4, v_user_id, 'owner') ON CONFLICT DO NOTHING;

  -- Token ledger history, spread across the last several months, per org.
  -- Izenzo Commodities: steady trading activity.
  INSERT INTO public.credit_ledger (org_id, delta, reason, created_at) VALUES
    (v_org_1, 10, 'Purchased 10 tokens', now() - interval '5 months'),
    (v_org_1, -1, 'Proof of Intent sealed', now() - interval '5 months' + interval '2 days'),
    (v_org_1, -3, 'WaD verification', now() - interval '4 months'),
    (v_org_1, 20, 'Purchased 20 tokens', now() - interval '3 months'),
    (v_org_1, -1, 'Proof of Intent sealed', now() - interval '2 months'),
    (v_org_1, -3, 'WaD verification', now() - interval '2 months' + interval '3 days'),
    (v_org_1, 5, 'Purchased 5 tokens', now() - interval '3 weeks')
  ON CONFLICT DO NOTHING;

  -- Kalahari AgriTrade: lighter activity, newer org.
  INSERT INTO public.credit_ledger (org_id, delta, reason, created_at) VALUES
    (v_org_2, 15, 'Purchased 15 tokens', now() - interval '2 months'),
    (v_org_2, -1, 'Proof of Intent sealed', now() - interval '6 weeks'),
    (v_org_2, -3, 'WaD verification', now() - interval '5 weeks'),
    (v_org_2, 1, 'Purchased 1 token', now() - interval '10 days')
  ON CONFLICT DO NOTHING;

  -- Nile Delta Energy Partners: high-value, larger token balance.
  INSERT INTO public.credit_ledger (org_id, delta, reason, created_at) VALUES
    (v_org_3, 25, 'Purchased 25 tokens', now() - interval '6 months'),
    (v_org_3, -1, 'Proof of Intent sealed', now() - interval '5 months'),
    (v_org_3, -3, 'WaD verification', now() - interval '5 months' + interval '4 days'),
    (v_org_3, 25, 'Purchased 25 tokens', now() - interval '3 months'),
    (v_org_3, -1, 'Proof of Intent sealed', now() - interval '1 month'),
    (v_org_3, -3, 'WaD verification', now() - interval '3 weeks'),
    (v_org_3, -1, 'Proof of Intent sealed', now() - interval '1 week')
  ON CONFLICT DO NOTHING;

  -- Cascadia Timber & Pulp: dormant, low balance.
  INSERT INTO public.credit_ledger (org_id, delta, reason, created_at) VALUES
    (v_org_4, 10, 'Purchased 10 tokens', now() - interval '7 months'),
    (v_org_4, -1, 'Proof of Intent sealed', now() - interval '6 months'),
    (v_org_4, -3, 'WaD verification', now() - interval '6 months' + interval '5 days')
  ON CONFLICT DO NOTHING;

  -- Sync each organisation's credit balance to the net of its ledger.
  UPDATE public.organisations o
  SET credits = COALESCE((SELECT SUM(delta) FROM public.credit_ledger WHERE org_id = o.id), 0)
  WHERE o.id IN (v_org_1, v_org_2, v_org_3, v_org_4);
END $$;
