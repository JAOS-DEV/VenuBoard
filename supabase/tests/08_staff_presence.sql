-- Staff presence module: schema, isolation, public eligibility, RPCs, grants.

BEGIN;

SELECT no_plan();

CREATE FUNCTION pg_temp.impersonate(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', p_user_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user_id::text, 'role', 'authenticated')::text,
    true
  );
END;
$$;

CREATE FUNCTION pg_temp.impersonate_anon()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('role', 'anon', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', 'anon', true);
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
END;
$$;

CREATE FUNCTION pg_temp.as_postgres()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
END;
$$;

GRANT EXECUTE ON FUNCTION pg_temp.impersonate(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION pg_temp.impersonate_anon() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION pg_temp.as_postgres() TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Structure
-- ---------------------------------------------------------------------------

SELECT has_table('public', 'staff_members', 'staff_members exists');
SELECT has_table('public', 'staff_public_profiles', 'staff_public_profiles exists');
SELECT has_table('public', 'staff_public_profile_translations', 'translations exist');
SELECT has_table('public', 'current_staff_presence', 'current_staff_presence exists');
SELECT has_table('public', 'staff_presence_events', 'presence events exist');
SELECT has_table('public', 'staff_consent_events', 'consent events exist');

SELECT ok(
  (SELECT relrowsecurity AND relforcerowsecurity
   FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'staff_members'),
  'staff_members has forced RLS'
);

SELECT ok(
  (SELECT relrowsecurity AND relforcerowsecurity
   FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'staff_public_profiles'),
  'staff_public_profiles has forced RLS'
);

SELECT ok(
  (SELECT relrowsecurity AND relforcerowsecurity
   FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'staff_public_profile_translations'),
  'translations have forced RLS'
);

SELECT ok(
  (SELECT relrowsecurity AND relforcerowsecurity
   FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'current_staff_presence'),
  'current_staff_presence has forced RLS'
);

SELECT has_index(
  'public',
  'staff_members',
  'staff_members_business_user_uidx',
  'linked user unique per business'
);

SELECT col_is_pk(
  'public',
  'staff_members',
  ARRAY['id']::name[],
  'staff_members primary key is id'
);
SELECT col_is_pk(
  'public',
  'staff_public_profiles',
  ARRAY['id']::name[],
  'staff_public_profiles primary key is id'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typtype = 'e'
      AND t.typname LIKE 'staff%'
  ),
  'no PostgreSQL enum types for staff presence'
);

SELECT throws_ok(
  $$ INSERT INTO public.staff_public_profiles (
       venue_id, business_id, staff_member_id, public_display_name
     ) VALUES (
       '00000000-0000-4000-8000-000000000201',
       '00000000-0000-4000-8000-000000000100',
       '00000000-0000-4000-8000-000000001101',
       'Cross tenant'
     ) $$,
  '23503',
  NULL,
  'composite FKs reject a harbor staff row claiming an atlas venue'
);

SELECT throws_ok(
  $$ INSERT INTO public.staff_public_profile_translations (
       staff_public_profile_id, venue_id, locale, public_bio
     ) VALUES (
       '00000000-0000-4000-8000-000000001202',
       '00000000-0000-4000-8000-000000000201',
       'en',
       'wrong venue'
     ) $$,
  '23503',
  NULL,
  'translation cannot claim a different venue from its parent'
);

SELECT throws_ok(
  $$ UPDATE public.staff_public_profiles
     SET avatar_storage_path = 'https://evil.example/x.png'
     WHERE id = '00000000-0000-4000-8000-000000001201' $$,
  '23514',
  NULL,
  'remote avatar URLs are rejected'
);

-- ---------------------------------------------------------------------------
-- Anonymous cannot read private tables
-- ---------------------------------------------------------------------------

SELECT pg_temp.impersonate_anon();

SELECT throws_ok(
  $$ SELECT internal_display_name FROM public.staff_members $$,
  '42501',
  NULL,
  'anon cannot read private staff records'
);

SELECT throws_ok(
  $$ SELECT public_display_name FROM public.staff_public_profiles $$,
  '42501',
  NULL,
  'anon cannot read staff_public_profiles directly'
);

SELECT throws_ok(
  $$ SELECT state FROM public.current_staff_presence $$,
  '42501',
  NULL,
  'anon cannot read current_staff_presence directly'
);

SELECT throws_ok(
  $$ SELECT source FROM public.staff_presence_events $$,
  '42501',
  NULL,
  'anon cannot read presence history'
);

SELECT is(
  has_function_privilege(
    'anon',
    'public.list_public_staff_presence(text,text,integer,integer)',
    'EXECUTE'
  ),
  true,
  'anon can execute the public staff RPC'
);

SELECT is(
  has_function_privilege(
    'anon',
    'public.create_staff_member_with_profile(uuid,jsonb)',
    'EXECUTE'
  ),
  false,
  'anon cannot execute create_staff_member_with_profile'
);

SELECT is(
  has_function_privilege(
    'anon',
    'public.set_staff_presence(uuid,text)',
    'EXECUTE'
  ),
  false,
  'anon cannot execute set_staff_presence'
);

-- ---------------------------------------------------------------------------
-- Public eligibility
-- ---------------------------------------------------------------------------

SELECT is(
  (public.list_public_staff_presence('harbor-light', 'en', 24, 0)->>'available')::boolean,
  true,
  'harbor-light staff module is publicly available'
);

SELECT ok(
  (public.list_public_staff_presence('harbor-light', 'en', 24, 0)->'items') @> '[{"display_name":"Mina Cole"}]'::jsonb,
  'public query includes the eligible published consented profile'
);

SELECT ok(
  NOT ((public.list_public_staff_presence('harbor-light', 'en', 24, 0)->'items')::text LIKE '%Jules Park%'),
  'unpublished pending profile is omitted'
);

SELECT ok(
  NOT ((public.list_public_staff_presence('harbor-light', 'en', 24, 0)::text) LIKE '%Mina Cole (internal)%'),
  'public response does not include the private internal name'
);

SELECT is(
  public.list_public_staff_presence('harbor-light', 'th', 24, 0)->>'heading',
  'ทีมที่อยู่ตอนนี้',
  'Thai heading is selected for the Thai locale'
);

SELECT is(
  (
    SELECT item->>'bio'
    FROM jsonb_array_elements(
      public.list_public_staff_presence('harbor-light', 'th', 24, 0)->'items'
    ) item
    WHERE item->>'display_name' = 'Mina Cole'
  ),
  'โฮสต์ริมท่าเรือสำหรับรอบเย็น',
  'Thai bio is selected with documented locale fallback'
);

SELECT ok(
  (public.list_public_staff_presence('night-orchid', 'en', 24, 0)->'items') @> '[{"display_name":"Nok Siri","presence_state":"present"}]'::jsonb,
  'show-present-only includes a currently present published profile'
);

SELECT ok(
  NOT ((public.list_public_staff_presence('night-orchid', 'en', 24, 0)::text) LIKE '%Alex Mori%'),
  'show-present-only omits a not-present published profile'
);

SELECT ok(
  NOT ((public.list_public_staff_presence('night-orchid', 'en', 24, 0)::text) LIKE '%Casey Ng%'),
  'expired presence is treated as not_present and omitted in present-only mode'
);

SELECT ok(
  NOT ((public.list_public_staff_presence('night-orchid', 'en', 24, 0)::text) LIKE '%Sam Harbor%'),
  'withdrawn consent hides immediately even if marked present'
);

SELECT ok(
  NOT ((public.list_public_staff_presence('night-orchid', 'en', 24, 0)::text) LIKE '%Pat Reed%'),
  'deactivated staff is hidden'
);

SELECT ok(
  NOT ((public.list_public_staff_presence('night-orchid', 'en', 24, 0)::text) LIKE '%Kim Hall%'),
  'restored unpublished unconsented staff is hidden'
);

SELECT ok(
  NOT ((public.list_public_staff_presence('night-orchid', 'en', 24, 0)::text) LIKE '%Rin Vale%'),
  'unpublished pending profile is hidden'
);

SELECT is(
  (public.list_public_staff_presence('draft-room', 'en', 24, 0)->>'available')::boolean,
  false,
  'draft unpublished venue is not available'
);

SELECT is(
  (public.list_public_staff_presence('trial-partial', 'en', 24, 0)->>'available')::boolean,
  false,
  'entitled but disabled module is hidden'
);

SELECT is(
  (public.list_public_staff_presence('trial-expired', 'en', 24, 0)->>'available')::boolean,
  false,
  'expired entitlement is hidden'
);

SELECT is(
  (public.list_public_staff_presence('silent-room', 'en', 24, 0)->>'available')::boolean,
  false,
  'suspended venue is hidden'
);

SELECT ok(
  (public.list_public_staff_presence('restricted-room', 'en', 24, 0)->'items') @> '[{"display_name":"River Cole"}]'::jsonb,
  'restricted venue remains publicly readable'
);

SELECT is(
  (public.list_public_staff_presence('trial-garden', 'en', 24, 0)->'items'->0->>'display_name'),
  'Alex Mori Garden',
  'show-all mode includes the published garden profile'
);

SELECT is(
  public.list_public_staff_presence('no-such-venue', 'en', 24, 0)->>'available',
  'false',
  'unknown slug does not leak tenant existence beyond available=false'
);

SELECT pg_temp.as_postgres();

UPDATE public.venue_module_settings
SET settings = '{"display_mode":"all_published","carousel_order":"display_order","presence_expiry_hours":12,"carousel_auto_advance":true}'::jsonb
WHERE id = '00000000-0000-4000-8000-000000000904';

SELECT pg_temp.impersonate_anon();

SELECT ok(
  (public.list_public_staff_presence('night-orchid', 'en', 24, 0)::text) LIKE '%Casey Ng%',
  'show-all mode includes expired presence as not_present rather than omitting the profile'
);

SELECT is(
  (
    SELECT item->>'presence_state'
    FROM jsonb_array_elements(
      public.list_public_staff_presence('night-orchid', 'en', 24, 0)->'items'
    ) item
    WHERE item->>'display_name' = 'Casey Ng'
  ),
  'not_present',
  'expired presence is advertised as not_present in show-all mode'
);

SELECT pg_temp.as_postgres();

UPDATE public.venue_module_settings
SET settings = '{"display_mode":"present_only","carousel_order":"display_order","presence_expiry_hours":12,"carousel_auto_advance":true}'::jsonb
WHERE id = '00000000-0000-4000-8000-000000000904';

-- ---------------------------------------------------------------------------
-- Tenant reads and writes
-- ---------------------------------------------------------------------------

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000010');

SELECT is(
  (SELECT count(*)::integer FROM public.staff_members WHERE business_id = '00000000-0000-4000-8000-000000000100'),
  2,
  'harbor owner can read private staff records for their business'
);

SELECT is(
  (SELECT count(*)::integer FROM public.staff_members WHERE business_id = '00000000-0000-4000-8000-000000000200' AND user_id IS DISTINCT FROM '00000000-0000-4000-8000-000000000010'),
  0,
  'harbor owner cannot read atlas private staff records they are not linked to'
);

SELECT is(
  (public.create_staff_member_with_profile(
    '00000000-0000-4000-8000-000000000201',
    '{"internal_display_name":"Nope","public_display_name":"Nope"}'::jsonb
  )->>'code'),
  'forbidden',
  'staff role at night-orchid cannot create staff profiles'
);

SELECT is(
  (public.create_staff_member_with_profile(
    '00000000-0000-4000-8000-000000000101',
    '{"internal_display_name":"New Harbor Host","public_display_name":"New Harbor Host","publication_state":"draft","consent_state":"pending"}'::jsonb
  )->>'ok')::boolean,
  true,
  'business owner can create unpublished staff at their venue'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000021');

SELECT ok(
  (SELECT count(*)::integer FROM public.staff_public_profiles WHERE venue_id = '00000000-0000-4000-8000-000000000201') > 0,
  'venue manager can read own-venue public profiles'
);

SELECT is(
  (SELECT count(*)::integer FROM public.staff_public_profiles WHERE venue_id = '00000000-0000-4000-8000-000000000101'),
  0,
  'venue manager cannot read a foreign venue profile'
);

SELECT is(
  (public.create_staff_member_with_profile(
    '00000000-0000-4000-8000-000000000101',
    '{"internal_display_name":"Hijack","public_display_name":"Hijack"}'::jsonb
  )->>'code'),
  'forbidden',
  'venue manager cannot create staff at a foreign venue'
);

SELECT is(
  (public.set_staff_presence(
    '00000000-0000-4000-8000-000000001203',
    'not_present'
  )->>'ok')::boolean,
  true,
  'venue manager can toggle presence at their venue'
);

SELECT is(
  (public.set_staff_presence(
    '00000000-0000-4000-8000-000000001203',
    'not_present'
  )->>'ok')::boolean,
  true,
  'presence toggle is idempotent'
);

SELECT is(
  (public.set_staff_presence(
    '00000000-0000-4000-8000-000000001203',
    'present'
  )->>'ok')::boolean,
  true,
  'venue manager can mark present again'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000024');

SELECT is(
  (public.set_staff_presence(
    '00000000-0000-4000-8000-000000001203',
    'not_present'
  )->>'ok')::boolean,
  true,
  'C3: staff can toggle their own presence'
);

SELECT is(
  (public.set_staff_presence(
    '00000000-0000-4000-8000-000000001204',
    'present'
  )->>'code'),
  'forbidden',
  'C3: staff cannot toggle another person'
);

SELECT is(
  (public.set_staff_public_consent(
    '00000000-0000-4000-8000-000000001203',
    'withdrawn'
  )->>'ok')::boolean,
  true,
  'linked staff can withdraw their own consent'
);

SELECT pg_temp.impersonate_anon();

SELECT ok(
  NOT ((public.list_public_staff_presence('night-orchid', 'en', 24, 0)::text) LIKE '%Nok Siri%'),
  'consent withdrawal removes the profile from public reads immediately'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000022');

SELECT is(
  (public.set_staff_presence(
    '00000000-0000-4000-8000-000000001207',
    'present'
  )->>'ok')::boolean,
  true,
  'C14: editor with a consented public profile can toggle own presence'
);

SELECT is(
  (public.set_staff_presence(
    '00000000-0000-4000-8000-000000001204',
    'present'
  )->>'code'),
  'forbidden',
  'C14 does not allow toggling someone else'
);

SELECT is(
  (public.create_staff_member_with_profile(
    '00000000-0000-4000-8000-000000000201',
    '{"internal_display_name":"Editor cannot","public_display_name":"Editor cannot"}'::jsonb
  )->>'code'),
  'forbidden',
  'content editor cannot manage public staff profiles'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000026');

SELECT is(
  (public.set_staff_presence(
    '00000000-0000-4000-8000-000000001209',
    'present'
  )->>'code'),
  'forbidden',
  'deactivated actor is denied'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000020');

SELECT is(
  (public.set_staff_presence(
    '00000000-0000-4000-8000-000000001212',
    'not_present'
  )->>'code'),
  'forbidden',
  'C16: restricted subscription blocks presence writes'
);

SELECT is(
  (public.create_staff_member_with_profile(
    '00000000-0000-4000-8000-000000000202',
    '{"internal_display_name":"Draft","public_display_name":"Draft"}'::jsonb
  )->>'code'),
  'forbidden',
  'C17: staff writes require the staff_presence entitlement'
);

SELECT is(
  (public.deactivate_staff_member('00000000-0000-4000-8000-000000001107')->>'ok')::boolean,
  true,
  'owner can deactivate staff'
);

SELECT is(
  (SELECT state FROM public.current_staff_presence WHERE staff_public_profile_id = '00000000-0000-4000-8000-000000001208'),
  'not_present',
  'deactivation resets presence to not_present'
);

SELECT pg_temp.impersonate_anon();

SELECT ok(
  NOT ((public.list_public_staff_presence('night-orchid', 'en', 24, 0)::text) LIKE '%Rin Vale%'),
  'deactivated staff remains hidden'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000020');

SELECT is(
  (public.restore_staff_member('00000000-0000-4000-8000-000000001107')->>'ok')::boolean,
  true,
  'owner can restore staff'
);

SELECT is(
  (SELECT publication_state FROM public.staff_public_profiles WHERE id = '00000000-0000-4000-8000-000000001208'),
  'draft',
  'restoration does not republish'
);

SELECT is(
  (SELECT consent_state FROM public.staff_public_profiles WHERE id = '00000000-0000-4000-8000-000000001208'),
  'pending',
  'restoration does not restore consent'
);

SELECT is(
  (SELECT state FROM public.current_staff_presence WHERE staff_public_profile_id = '00000000-0000-4000-8000-000000001208'),
  'not_present',
  'restoration remains not_present'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.staff_public_profile_translations
    WHERE staff_public_profile_id = '00000000-0000-4000-8000-000000001203'
  ) > 0,
  true,
  'deactivation does not delete translations of other staff'
);

SELECT is(
  (public.bulk_mark_staff_not_present('00000000-0000-4000-8000-000000000201')->>'ok')::boolean,
  true,
  'owner can bulk mark night-orchid not present'
);

SELECT pg_temp.as_postgres();

SELECT is(
  (SELECT state FROM public.current_staff_presence WHERE staff_public_profile_id = '00000000-0000-4000-8000-000000001201'),
  'present',
  'bulk reset is confined to the requested venue'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000020');

SELECT is(
  (public.assign_staff_to_venue(
    '00000000-0000-4000-8000-000000001103',
    '00000000-0000-4000-8000-000000000205',
    '{"public_display_name":"Nok at Garden","publication_state":"draft","consent_state":"pending"}'::jsonb
  )->>'ok')::boolean,
  true,
  'owner can assign existing business staff to another authorized venue'
);

SELECT is(
  (public.assign_staff_to_venue(
    '00000000-0000-4000-8000-000000001101',
    '00000000-0000-4000-8000-000000000201',
    '{"public_display_name":"Cross business"}'::jsonb
  )->>'code'),
  'forbidden',
  'cannot assign a staff record across businesses'
);

-- ---------------------------------------------------------------------------
-- Platform support / C19
-- ---------------------------------------------------------------------------

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000001');

SELECT is(
  (SELECT count(*)::integer FROM public.staff_members WHERE business_id = '00000000-0000-4000-8000-000000000100'),
  0,
  'C11: platform admin without a support session cannot read private staff'
);

SELECT is(
  (public.create_staff_member_with_profile(
    '00000000-0000-4000-8000-000000000101',
    '{"internal_display_name":"Platform","public_display_name":"Platform"}'::jsonb
  )->>'code'),
  'forbidden',
  'C19: platform admin cannot write tenant staff without a write session'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000002');

SELECT is(
  (SELECT count(*)::integer FROM public.staff_members WHERE business_id = '00000000-0000-4000-8000-000000000200'),
  0,
  'platform support without a live session cannot read private staff'
);

SELECT pg_temp.as_postgres();

INSERT INTO public.support_sessions (
  operator_user_id, target_business_id, target_venue_id, reason, mode,
  write_granted_by, write_granted_at, write_expires_at, started_at, expires_at
) VALUES (
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000100',
  '00000000-0000-4000-8000-000000000101',
  'Staff presence C19 test',
  'write',
  '00000000-0000-4000-8000-000000000001',
  now(),
  now() + interval '1 hour',
  now(),
  now() + interval '4 hours'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000001');

SELECT ok(
  (SELECT count(*)::integer FROM public.staff_members WHERE business_id = '00000000-0000-4000-8000-000000000100') >= 2,
  'C11: platform admin with a support session can read private staff'
);

SELECT is(
  (public.create_staff_member_with_profile(
    '00000000-0000-4000-8000-000000000101',
    '{"internal_display_name":"Support Host","public_display_name":"Support Host","publication_state":"draft"}'::jsonb
  )->>'ok')::boolean,
  true,
  'C19: platform admin with write access can create a staff profile'
);

SELECT is(
  (public.set_staff_presence(
    '00000000-0000-4000-8000-000000001201',
    'not_present'
  )->>'code'),
  'forbidden',
  'C19 does not grant toggle_staff_presence to platform admin'
);

-- ---------------------------------------------------------------------------
-- Audit privacy, definer configuration, overloads
-- ---------------------------------------------------------------------------

SELECT pg_temp.as_postgres();

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM public.audit_log
    WHERE target_table IN ('staff_members', 'staff_public_profiles', 'current_staff_presence')
      AND (
        COALESCE(previous_state::text, '') ILIKE '%internal%'
        OR COALESCE(resulting_state::text, '') ILIKE '%internal%'
        OR COALESCE(summary, '') ILIKE '%@example.com%'
        OR COALESCE(metadata::text, '') ILIKE '%bio%'
      )
  ),
  'staff audit records do not carry private profile payload'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname IN ('public', 'app_private')
      AND p.prosecdef
      AND p.proname IN (
        'list_public_staff_presence',
        'create_staff_member_with_profile',
        'assign_staff_to_venue',
        'update_staff_public_profile',
        'set_staff_public_consent',
        'set_staff_presence',
        'bulk_mark_staff_not_present',
        'deactivate_staff_member',
        'restore_staff_member',
        'may_set_staff_presence',
        'write_current_presence',
        'write_staff_audit'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS cfg
        WHERE cfg IN ('search_path=', 'search_path=""')
      )
  ),
  'staff definer functions fix search_path to empty'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'list_public_staff_presence',
        'create_staff_member_with_profile',
        'assign_staff_to_venue',
        'update_staff_public_profile',
        'set_staff_public_consent',
        'set_staff_presence',
        'bulk_mark_staff_not_present',
        'deactivate_staff_member',
        'restore_staff_member'
      )
    GROUP BY p.proname
    HAVING count(*) > 1
  ),
  'staff public RPCs have no overloads'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) AS a
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'create_staff_member_with_profile',
        'set_staff_presence',
        'deactivate_staff_member'
      )
      AND a.grantee = 0
      AND a.privilege_type = 'EXECUTE'
  ),
  'PUBLIC execute is revoked on staff write RPCs'
);

SELECT * FROM finish();

ROLLBACK;
