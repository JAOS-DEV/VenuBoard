-- Atmosphere module: schema, isolation, public visibility, authz, expiry, definer security.

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

-- Fixed seed UUIDs
-- harbor.owner  00000000-0000-4000-8000-000000000010
-- atlas.owner   00000000-0000-4000-8000-000000000020
-- atlas.manager 00000000-0000-4000-8000-000000000021
-- atlas.editor  00000000-0000-4000-8000-000000000022
-- atlas.staff   00000000-0000-4000-8000-000000000024
-- deactivated   00000000-0000-4000-8000-000000000026
-- platform.admin 00000000-0000-4000-8000-000000000001
-- harbor_venue  00000000-0000-4000-8000-000000000101
-- night_orchid  00000000-0000-4000-8000-000000000201
-- draft_room    00000000-0000-4000-8000-000000000202
-- restricted    00000000-0000-4000-8000-000000000203
-- silent_room   00000000-0000-4000-8000-000000000204
-- trial_partial 00000000-0000-4000-8000-000000000206
-- trial_expired 00000000-0000-4000-8000-000000000209

SELECT has_table('public', 'venue_atmosphere', 'venue_atmosphere exists');
SELECT has_table('public', 'venue_atmosphere_events', 'venue_atmosphere_events exists');

SELECT ok(
  (SELECT relrowsecurity AND relforcerowsecurity
   FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'venue_atmosphere'),
  'venue_atmosphere forces RLS'
);

SELECT ok(
  (SELECT relrowsecurity AND relforcerowsecurity
   FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'venue_atmosphere_events'),
  'venue_atmosphere_events forces RLS'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.venue_atmosphere'::regclass
      AND conname = 'venue_atmosphere_venue_business_fkey'
  ),
  'venue_atmosphere has composite venue/business FK'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'venue_atmosphere_expires_idx'
  ),
  'venue_atmosphere expiry index exists'
);

SELECT throws_ok(
  $$ INSERT INTO public.venue_atmosphere (
       venue_id, business_id, atmosphere_state, set_at, expires_at, changed_by
     ) VALUES (
       '00000000-0000-4000-8000-000000000101',
       '00000000-0000-4000-8000-000000000100',
       'packed', now(), now() + interval '2 hours',
       '00000000-0000-4000-8000-000000000010'
     ) $$,
  '23514',
  NULL,
  'invalid atmosphere state is rejected'
);

SELECT throws_ok(
  $$ INSERT INTO public.venue_atmosphere (
       venue_id, business_id, atmosphere_state, set_at, expires_at, changed_by
     ) VALUES (
       '00000000-0000-4000-8000-000000000101',
       '00000000-0000-4000-8000-000000000100',
       'calm', now(), now() + interval '10 minutes',
       '00000000-0000-4000-8000-000000000010'
     ) $$,
  '23514',
  NULL,
  'expiry shorter than 30 minutes is rejected'
);

SELECT throws_ok(
  $$ INSERT INTO public.venue_atmosphere (
       venue_id, business_id, atmosphere_state, set_at, expires_at, changed_by
     ) VALUES (
       '00000000-0000-4000-8000-000000000205',
       '00000000-0000-4000-8000-000000000100',
       'calm', now(), now() + interval '2 hours',
       '00000000-0000-4000-8000-000000000010'
     ) $$,
  '23503',
  NULL,
  'cross-tenant venue/business pair is rejected'
);

SELECT pg_temp.impersonate_anon();

SELECT throws_ok(
  $$ SELECT count(*)::integer FROM public.venue_atmosphere $$,
  '42501',
  NULL,
  'anonymous cannot read venue_atmosphere'
);

SELECT throws_ok(
  $$ SELECT count(*)::integer FROM public.venue_atmosphere_events $$,
  '42501',
  NULL,
  'anonymous cannot read atmosphere history'
);

SELECT throws_ok(
  $$ SELECT set_venue_atmosphere(
       '00000000-0000-4000-8000-000000000101'::uuid, 'lively', 120
     ) $$,
  '42501',
  NULL,
  'anon cannot execute set_venue_atmosphere'
);

SELECT pg_temp.as_postgres();

SELECT ok(
  (SELECT (get_public_venue_atmosphere('harbor-light', 'en')->>'available')::boolean),
  'public query returns Harbor Light unexpired atmosphere'
);

SELECT is(
  get_public_venue_atmosphere('harbor-light', 'en')->>'status_key',
  'lively',
  'Harbor Light public status is lively'
);

SELECT ok(
  get_public_venue_atmosphere('harbor-light', 'en') ? 'heading'
  AND NOT (get_public_venue_atmosphere('harbor-light', 'en') ? 'changed_by')
  AND NOT (get_public_venue_atmosphere('harbor-light', 'en') ? 'actor_user_id'),
  'public payload has heading and no actor identifiers'
);

SELECT is(
  get_public_venue_atmosphere('harbor-light', 'th')->>'heading',
  'ตอนนี้ที่ฮาร์เบอร์ไลต์',
  'Thai heading is selected for Harbor Light'
);

SELECT ok(
  NOT (get_public_venue_atmosphere('trial-expired', 'en')->>'available')::boolean,
  'expired atmosphere is absent publicly'
);

SELECT ok(
  NOT (get_public_venue_atmosphere('silent-room', 'en')->>'available')::boolean,
  'disabled module hides public atmosphere'
);

SELECT ok(
  NOT (get_public_venue_atmosphere('trial-partial', 'en')->>'available')::boolean,
  'not-entitled venue hides public atmosphere'
);

SELECT ok(
  NOT (get_public_venue_atmosphere('draft-room', 'en')->>'available')::boolean,
  'draft venue hides public atmosphere'
);

SELECT ok(
  (SELECT (get_public_venue_atmosphere('restricted-room', 'en')->>'available')::boolean),
  'restricted venue remains publicly readable under C16'
);

SELECT ok(
  (SELECT (get_public_venue_atmosphere('night-orchid', 'en')->>'available')::boolean),
  '18+ venue atmosphere is independent of the adult notice'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000010');

SELECT ok(
  (SELECT set_venue_atmosphere(
     '00000000-0000-4000-8000-000000000101'::uuid, 'calm', 60
   )->>'ok')::boolean,
  'harbor.owner can set Harbor Light atmosphere'
);

SELECT is(
  get_public_venue_atmosphere('harbor-light', 'en')->>'status_key',
  'calm',
  'public page reflects the replaced status'
);

SELECT ok(
  (SELECT clear_venue_atmosphere(
     '00000000-0000-4000-8000-000000000101'::uuid
   )->>'ok')::boolean,
  'harbor.owner can clear atmosphere'
);

SELECT ok(
  NOT (get_public_venue_atmosphere('harbor-light', 'en')->>'available')::boolean,
  'clearing removes public atmosphere immediately'
);

SELECT ok(
  (SELECT clear_venue_atmosphere(
     '00000000-0000-4000-8000-000000000101'::uuid
   )->>'ok')::boolean,
  'clearing an absent row is idempotent'
);

SELECT is(
  set_venue_atmosphere(
    '00000000-0000-4000-8000-000000000204'::uuid, 'lively', 120
  )->>'code',
  'forbidden',
  'harbor.owner cannot write Silent Room atmosphere'
);

SELECT is(
  (SELECT count(*)::integer FROM public.venue_atmosphere
   WHERE venue_id = '00000000-0000-4000-8000-000000000204'),
  0,
  'harbor.owner cannot read Silent Room atmosphere rows'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000021');

SELECT ok(
  (SELECT set_venue_atmosphere(
     '00000000-0000-4000-8000-000000000201'::uuid, 'high_energy', 90
   )->>'ok')::boolean,
  'venue manager can set atmosphere on their venue'
);

SELECT is(
  set_venue_atmosphere(
    '00000000-0000-4000-8000-000000000101'::uuid, 'social', 120
  )->>'code',
  'forbidden',
  'venue manager cannot write a foreign venue'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000022');

SELECT isnt_empty(
  $$ SELECT venue_id FROM public.venue_atmosphere
     WHERE venue_id = '00000000-0000-4000-8000-000000000201' $$,
  'C6: opted-in editor may read atmosphere admin rows'
);

SELECT ok(
  (SELECT set_venue_atmosphere(
     '00000000-0000-4000-8000-000000000201'::uuid, 'lively', 30
   )->>'ok')::boolean,
  'C6: opted-in editor may set atmosphere'
);

SELECT pg_temp.as_postgres();
UPDATE public.venue_module_settings
SET settings = jsonb_set(settings, '{front_of_house_may_update}', 'false'::jsonb)
WHERE venue_id = '00000000-0000-4000-8000-000000000201'
  AND module_key = 'atmosphere';

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000022');

SELECT is(
  set_venue_atmosphere(
    '00000000-0000-4000-8000-000000000201'::uuid, 'calm', 30
  )->>'code',
  'forbidden',
  'C6: editor is denied when opt-in is off'
);

SELECT pg_temp.as_postgres();
UPDATE public.venue_module_settings
SET settings = jsonb_set(settings, '{front_of_house_may_update}', 'true'::jsonb)
WHERE venue_id = '00000000-0000-4000-8000-000000000201'
  AND module_key = 'atmosphere';

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000024');

SELECT ok(
  (SELECT set_venue_atmosphere(
     '00000000-0000-4000-8000-000000000201'::uuid, 'social', 60
   )->>'ok')::boolean,
  'C6: opted-in staff may set atmosphere'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000026');

SELECT is(
  set_venue_atmosphere(
    '00000000-0000-4000-8000-000000000201'::uuid, 'calm', 60
  )->>'code',
  'forbidden',
  'deactivated actor is denied'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000001');

SELECT is(
  set_venue_atmosphere(
    '00000000-0000-4000-8000-000000000101'::uuid, 'calm', 60
  )->>'code',
  'forbidden',
  'platform role alone cannot write tenant atmosphere'
);

SELECT is(
  (SELECT count(*)::integer FROM public.venue_atmosphere),
  0,
  'platform role alone cannot read atmosphere tables'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000020');

SELECT is(
  set_venue_atmosphere(
    '00000000-0000-4000-8000-000000000203'::uuid, 'lively', 120
  )->>'code',
  'forbidden',
  'C16: restricted venue blocks atmosphere writes'
);

SELECT is(
  set_venue_atmosphere(
    '00000000-0000-4000-8000-000000000206'::uuid, 'lively', 120
  )->>'code',
  'forbidden',
  'C17: not-entitled venue blocks atmosphere writes'
);

SELECT is(
  set_venue_atmosphere(
    '00000000-0000-4000-8000-000000000204'::uuid, 'lively', 120
  )->>'code',
  'forbidden',
  'disabled module blocks atmosphere writes'
);

SELECT ok(
  (SELECT set_venue_atmosphere(
     '00000000-0000-4000-8000-000000000201'::uuid, 'calm', 120
   )->>'ok')::boolean,
  'owner can set Night Orchid after C6 tests'
);

SELECT ok(
  (SELECT set_venue_atmosphere(
     '00000000-0000-4000-8000-000000000201'::uuid, 'calm', 120
   )->>'ok')::boolean,
  'repeat set of the same state is deterministic success'
);

SELECT cmp_ok(
  (SELECT count(*)::integer FROM public.venue_atmosphere_events
   WHERE venue_id = '00000000-0000-4000-8000-000000000201'),
  '>=',
  2,
  'history is append-only across replacements'
);

SELECT pg_temp.as_postgres();

SELECT throws_ok(
  $$ UPDATE public.venue_atmosphere_events SET action = 'clear' $$,
  '25006',
  NULL,
  'history updates are rejected'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000002');

SELECT is(
  (SELECT count(*)::integer FROM public.venue_atmosphere),
  0,
  'platform support without a live session cannot read atmosphere'
);

SELECT pg_temp.as_postgres();

INSERT INTO public.support_sessions (
  operator_user_id, target_business_id, target_venue_id, reason, mode,
  write_granted_by, write_granted_at, write_expires_at, started_at, expires_at
) VALUES (
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000100',
  '00000000-0000-4000-8000-000000000101',
  'Atmosphere C19 test',
  'write',
  '00000000-0000-4000-8000-000000000001',
  now(),
  now() + interval '1 hour',
  now(),
  now() + interval '4 hours'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000001');

SELECT ok(
  (SELECT set_venue_atmosphere(
     '00000000-0000-4000-8000-000000000101'::uuid, 'social', 60
   )->>'ok')::boolean,
  'C19: platform admin with write access can set atmosphere'
);

SELECT ok(
  (SELECT count(*)::integer FROM public.venue_atmosphere
   WHERE venue_id = '00000000-0000-4000-8000-000000000101') = 1,
  'C11: platform admin with a support session can read atmosphere'
);

SELECT pg_temp.as_postgres();

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM public.audit_log
    WHERE target_table = 'venue_atmosphere'
      AND (
        metadata::text ILIKE '%@%'
        OR coalesce(previous_state::text, '') ILIKE '%email%'
        OR coalesce(resulting_state::text, '') ILIKE '%password%'
      )
  ),
  'atmosphere audit rows contain no unsafe payload'
);

SELECT ok(
  (
    SELECT every(
      prosecdef AND EXISTS (
        SELECT 1
        FROM unnest(coalesce(p.proconfig, ARRAY[]::text[])) AS cfg
        WHERE cfg IN ('search_path=', 'search_path=""')
      )
    )
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname IN ('public', 'app_private')
      AND p.proname IN (
        'set_venue_atmosphere',
        'clear_venue_atmosphere',
        'update_atmosphere_module_settings',
        'get_public_venue_atmosphere',
        'may_write_atmosphere',
        'append_atmosphere_event'
      )
      AND p.prosecdef
  ),
  'atmosphere definer functions fix search_path to empty'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'set_venue_atmosphere',
        'clear_venue_atmosphere',
        'update_atmosphere_module_settings',
        'get_public_venue_atmosphere'
      )
    GROUP BY p.proname
    HAVING count(*) > 1
  ),
  'atmosphere public RPCs have no overloads'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    CROSS JOIN LATERAL aclexplode(
      COALESCE(p.proacl, acldefault('f', p.proowner))
    ) AS a
    WHERE n.nspname = 'app_private'
      AND (
        p.proname LIKE '%atmosphere%'
        OR p.proname IN (
          'may_read_atmosphere_admin',
          'may_write_atmosphere'
        )
      )
      AND a.grantee = 0
      AND a.privilege_type = 'EXECUTE'
  ),
  'PUBLIC cannot execute atmosphere private helpers'
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'app_private.append_atmosphere_event(uuid,uuid,text,text,text,integer,timestamptz)',
    'EXECUTE'
  )
  AND NOT has_function_privilege(
    'authenticated',
    'app_private.append_atmosphere_event(uuid,uuid,text,text,text,integer,timestamptz)',
    'EXECUTE'
  )
  AND NOT has_function_privilege(
    'anon',
    'app_private.write_atmosphere_audit(uuid,uuid,uuid,text,jsonb,jsonb)',
    'EXECUTE'
  )
  AND NOT has_function_privilege(
    'authenticated',
    'app_private.write_atmosphere_audit(uuid,uuid,uuid,text,jsonb,jsonb)',
    'EXECUTE'
  )
  AND NOT has_function_privilege(
    'anon',
    'app_private.may_write_atmosphere(uuid)',
    'EXECUTE'
  ),
  'clients cannot execute atmosphere write helpers'
);

SELECT pg_temp.impersonate_anon();

SELECT ok(
  (SELECT has_function_privilege(
     'anon',
     'public.get_public_venue_atmosphere(text, text)',
     'EXECUTE'
   )),
  'anon can execute the public atmosphere RPC'
);

SELECT throws_ok(
  $$ SELECT update_atmosphere_module_settings(
       '00000000-0000-4000-8000-000000000101'::uuid, '{}'::jsonb
     ) $$,
  '42501',
  NULL,
  'anon cannot execute atmosphere settings RPC'
);

SELECT throws_ok(
  $$ SELECT app_private.append_atmosphere_event(
       '00000000-0000-4000-8000-000000000101'::uuid,
       '00000000-0000-4000-8000-000000000100'::uuid,
       NULL,
       'lively',
       'set',
       120,
       now()
     ) $$,
  '42501',
  NULL,
  'anon cannot execute append_atmosphere_event'
);

SELECT pg_temp.as_postgres();

SELECT throws_ok(
  $$ INSERT INTO public.venue_module_settings (
       venue_id, module_key, is_enabled, is_publicly_visible, display_order,
       settings, updated_by
     ) VALUES (
       '00000000-0000-4000-8000-000000000201',
       'atmosphere',
       true, true, 9,
       '{"css":"body{}","default_expiry_minutes":120}'::jsonb,
       '00000000-0000-4000-8000-000000000020'
     ) $$,
  '23514',
  NULL,
  'atmosphere settings reject css injection'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000010');

SELECT ok(
  (SELECT set_venue_atmosphere(
     '00000000-0000-4000-8000-000000000101'::uuid, 'lively', 120
   )->>'ok')::boolean,
  'restore Harbor Light lively for later suites'
);

SELECT pg_temp.as_postgres();

SELECT * FROM finish();

ROLLBACK;
