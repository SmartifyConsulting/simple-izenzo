-- Provisions the "Holarc" test account for the Switch-test-user menu.
--
-- Run this once in the Supabase SQL editor (it runs as the postgres role, so RLS does not apply and
-- no service-role key is needed). It is idempotent — running it again just resets the password and
-- re-attaches the account's company, profile and role rows.
--
-- The menu itself is a hardcoded list in src/lib/testUsers.ts, NOT a database table, so pairing this
-- script with that file's entry is what actually makes Holarc show up. The switcher never stores the
-- password server-side: it asks for it once per browser tab and keeps it in session storage only.

do $$
declare
  v_email    text := 'support@holarc.com';
  v_password text := 'ChangeMe123!';   -- used once by the switcher; change to whatever you prefer
  v_name     text := 'Holarc';
  v_org      text := 'Holarc';
  v_user_id  uuid;
  v_org_id   uuid;
begin
  select id into v_user_id from auth.users where lower(email) = lower(v_email);

  if v_user_id is null then
    v_user_id := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated',
      lower(v_email), crypt(v_password, gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', v_name),
      '', '', '', ''
    );

    insert into auth.identities (
      id, user_id, provider_id, provider, identity_data,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), v_user_id, v_user_id::text, 'email',
      jsonb_build_object('sub', v_user_id::text, 'email', lower(v_email), 'email_verified', true),
      now(), now(), now()
    );
  else
    -- Already exists: just make sure the password the switcher will be given still works.
    update auth.users
       set encrypted_password = crypt(v_password, gen_salt('bf')),
           email_confirmed_at  = coalesce(email_confirmed_at, now()),
           updated_at          = now()
     where id = v_user_id;
  end if;

  select id into v_org_id from public.organisations where name = v_org limit 1;
  if v_org_id is null then
    insert into public.organisations (name, primary_contact_name, primary_contact_email)
    values (v_org, v_name, lower(v_email))
    returning id into v_org_id;
  end if;

  -- account_type 'company' — Holarc is a company seat, so registration asks it for an Authority to
  -- Act document rather than proof of residential address. onboarding_required false so the seat can
  -- be switched into directly for testing instead of being walked through the wizard.
  insert into public.profiles (
    id, email, full_name, org_id, account_type, onboarding_required, email_verified_at
  )
  values (
    v_user_id, lower(v_email), v_name, v_org_id, 'company', false, now()
  )
  on conflict (id) do update
    set email               = excluded.email,
        full_name           = coalesce(public.profiles.full_name, excluded.full_name),
        org_id              = excluded.org_id,
        account_type        = coalesce(public.profiles.account_type, excluded.account_type),
        onboarding_required = false,
        email_verified_at   = coalesce(public.profiles.email_verified_at, excluded.email_verified_at),
        updated_at          = now();

  insert into public.org_members (org_id, user_id, role)
  select v_org_id, v_user_id, 'owner'
  where not exists (
    select 1 from public.org_members where org_id = v_org_id and user_id = v_user_id
  );

  insert into public.user_roles (user_id, role)
  select v_user_id, 'party'
  where not exists (
    select 1 from public.user_roles where user_id = v_user_id and role = 'party'
  );

  raise notice 'Holarc ready — sign in as % (user %)', lower(v_email), v_user_id;
end $$;
