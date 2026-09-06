-- Booking enquiries: schema, intake, isolation, workflow, grants.

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

CREATE FUNCTION pg_temp.future_local()
RETURNS text
LANGUAGE sql
AS $$
  SELECT to_char(
    (pg_catalog.now() + interval '8 days') AT TIME ZONE 'Asia/Bangkok',
    'YYYY-MM-DD"T"HH24:MI'
  );
$$;

GRANT EXECUTE ON FUNCTION pg_temp.future_local() TO anon, authenticated;

CREATE FUNCTION pg_temp.submit_payload(p_key text, p_name text, p_email text)
RETURNS jsonb
LANGUAGE sql
AS $$
  SELECT jsonb_build_object(
    'idempotency_key', p_key,
    'display_name', p_name,
    'email', p_email,
    'party_size', 2,
    'requested_local', pg_temp.future_local(),
    'locale', 'en',
    'message', 'Fictional visit request.'
  );
$$;

GRANT EXECUTE ON FUNCTION pg_temp.submit_payload(text, text, text)
  TO anon, authenticated;

SELECT pg_temp.as_postgres();

INSERT INTO public.venue_module_settings (
  venue_id, module_key, is_enabled, is_publicly_visible, settings, updated_by
)
SELECT
  v.id,
  'booking_requests',
  true,
  true,
  '{"accepting_enquiries":true,"min_party_size":1,"max_party_size":12,"horizon_days":90,"lead_time_minutes":60,"instructions_en":"","instructions_th":""}'::jsonb,
  '00000000-0000-4000-8000-000000000010'
FROM public.venues v
WHERE v.slug IN ('harbor-light', 'night-orchid')
  AND app_private.module_is_entitled(v.id, 'booking_requests')
ON CONFLICT (venue_id, module_key) DO UPDATE SET
  is_enabled = EXCLUDED.is_enabled,
  is_publicly_visible = EXCLUDED.is_publicly_visible,
  settings = EXCLUDED.settings;

INSERT INTO public.venue_module_settings (
  venue_id, module_key, is_enabled, is_publicly_visible, settings, updated_by
)
SELECT
  v.id,
  'booking_requests',
  true,
  true,
  '{"accepting_enquiries":false,"min_party_size":1,"max_party_size":10,"horizon_days":90,"lead_time_minutes":60,"instructions_en":"","instructions_th":""}'::jsonb,
  '00000000-0000-4000-8000-000000000020'
FROM public.venues v
WHERE v.slug = 'trial-garden'
  AND app_private.module_is_entitled(v.id, 'booking_requests')
ON CONFLICT (venue_id, module_key) DO UPDATE SET
  settings = EXCLUDED.settings;

INSERT INTO public.venue_module_settings (
  venue_id, module_key, is_enabled, is_publicly_visible, settings, updated_by
)
SELECT
  v.id,
  'booking_requests',
  true,
  true,
  '{"accepting_enquiries":true,"min_party_size":1,"max_party_size":10,"horizon_days":90,"lead_time_minutes":60,"instructions_en":"","instructions_th":""}'::jsonb,
  '00000000-0000-4000-8000-000000000020'
FROM public.venues v
WHERE v.slug = 'restricted-room'
  AND app_private.module_is_entitled(v.id, 'booking_requests')
ON CONFLICT (venue_id, module_key) DO UPDATE SET
  is_enabled = EXCLUDED.is_enabled,
  is_publicly_visible = EXCLUDED.is_publicly_visible,
  settings = EXCLUDED.settings;

INSERT INTO public.booking_requests (
  id, venue_id, business_id, locale, party_size, requested_for, state
)
SELECT
  '00000000-0000-4000-8000-000000000601',
  v.id,
  v.business_id,
  'en',
  2,
  pg_catalog.now() + interval '7 days',
  'new'
FROM public.venues v
WHERE v.slug = 'harbor-light'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.booking_request_contacts (
  booking_request_id, venue_id, customer_display_name, customer_email
)
SELECT
  '00000000-0000-4000-8000-000000000601',
  v.id,
  'Alex Harbour',
  'alex.harbour@example.com'
FROM public.venues v
WHERE v.slug = 'harbor-light'
ON CONFLICT (booking_request_id) DO NOTHING;

INSERT INTO public.booking_requests (
  id, venue_id, business_id, locale, party_size, requested_for, state
)
SELECT
  '00000000-0000-4000-8000-000000000605',
  v.id,
  v.business_id,
  'en',
  2,
  pg_catalog.now() + interval '7 days',
  'new'
FROM public.venues v
WHERE v.slug = 'night-orchid'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.booking_request_contacts (
  booking_request_id, venue_id, customer_display_name, customer_email
)
SELECT
  '00000000-0000-4000-8000-000000000605',
  v.id,
  'Nok Visitor',
  'nok.visitor@example.com'
FROM public.venues v
WHERE v.slug = 'night-orchid'
ON CONFLICT (booking_request_id) DO NOTHING;

INSERT INTO public.booking_request_events (
  booking_request_id, venue_id, action, from_state, to_state
)
SELECT
  '00000000-0000-4000-8000-000000000601',
  v.id,
  'created',
  NULL,
  'new'
FROM public.venues v
WHERE v.slug = 'harbor-light'
  AND NOT EXISTS (
    SELECT 1
    FROM public.booking_request_events e
    WHERE e.booking_request_id = '00000000-0000-4000-8000-000000000601'
  );

INSERT INTO public.booking_request_events (
  booking_request_id, venue_id, action, from_state, to_state
)
SELECT
  '00000000-0000-4000-8000-000000000605',
  v.id,
  'created',
  NULL,
  'new'
FROM public.venues v
WHERE v.slug = 'night-orchid'
  AND NOT EXISTS (
    SELECT 1
    FROM public.booking_request_events e
    WHERE e.booking_request_id = '00000000-0000-4000-8000-000000000605'
  );

INSERT INTO public.booking_requests (
  id, venue_id, business_id, locale, party_size, requested_for, state
)
SELECT
  '00000000-0000-4000-8000-00000000060b',
  v.id,
  v.business_id,
  'en',
  2,
  pg_catalog.now() + interval '7 days',
  'new'
FROM public.venues v
WHERE v.slug = 'trial-expired'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.booking_request_contacts (
  booking_request_id, venue_id, customer_display_name, customer_email
)
SELECT
  '00000000-0000-4000-8000-00000000060b',
  v.id,
  'Expired Guest',
  'expired.guest@example.com'
FROM public.venues v
WHERE v.slug = 'trial-expired'
ON CONFLICT (booking_request_id) DO NOTHING;

INSERT INTO public.booking_requests (
  id, venue_id, business_id, locale, party_size, requested_for, state
)
SELECT
  '00000000-0000-4000-8000-0000000006c1',
  v.id,
  v.business_id,
  'en',
  2,
  pg_catalog.now() + interval '7 days',
  'new'
FROM public.venues v
WHERE v.slug = 'harbor-light'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.booking_request_contacts (
  booking_request_id, venue_id, customer_display_name, customer_email
)
SELECT
  '00000000-0000-4000-8000-0000000006c1',
  v.id,
  'Session Guest',
  'session.guest@example.com'
FROM public.venues v
WHERE v.slug = 'harbor-light'
ON CONFLICT (booking_request_id) DO NOTHING;

SELECT has_table('public', 'booking_requests', 'booking_requests exists');
SELECT has_table('public', 'booking_request_contacts', 'contacts table exists');
SELECT has_table('public', 'booking_request_events', 'events table exists');
SELECT has_table('public', 'booking_intake_idempotency', 'idempotency table exists');
SELECT has_table('public', 'booking_intake_windows', 'quota table exists');

SELECT col_is_pk('public', 'booking_requests', 'id', 'uuid primary key');

SELECT ok(
  (SELECT relrowsecurity AND relforcerowsecurity
   FROM pg_class c
   JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'booking_requests'),
  'booking_requests has forced RLS'
);

SELECT ok(
  (SELECT relrowsecurity AND relforcerowsecurity
   FROM pg_class c
   JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'booking_request_contacts'),
  'contacts has forced RLS'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'booking_requests_venue_business_fkey'
  ),
  'composite venue/business FK exists'
);

SELECT throws_ok(
  $$ INSERT INTO public.booking_requests (
       venue_id, business_id, locale, party_size, requested_for, state
     ) VALUES (
       '00000000-0000-4000-8000-000000000101',
       '00000000-0000-4000-8000-000000000200',
       'en', 2, now() + interval '3 days', 'new'
     ) $$,
  '23503',
  NULL,
  'ADR-037 rejects mismatched business_id'
);

SELECT pg_temp.impersonate_anon();

SELECT throws_ok(
  $$ SELECT count(*) FROM public.booking_requests $$,
  '42501',
  NULL,
  'anonymous cannot read booking_requests'
);

SELECT throws_ok(
  $$ SELECT count(*) FROM public.booking_request_contacts $$,
  '42501',
  NULL,
  'anonymous cannot read contacts'
);

SELECT throws_ok(
  $$ SELECT public.submit_booking_enquiry(
       'harbor-light',
       pg_temp.submit_payload(
         '11111111-1111-4111-8111-111111111111',
         'Anon Bypass',
         'anon.bypass@example.com'
       )
     ) $$,
  '42501',
  NULL,
  'anon cannot execute intake RPC'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000010');

SELECT throws_ok(
  $$ SELECT public.submit_booking_enquiry(
       'harbor-light',
       pg_temp.submit_payload(
         '11111111-1111-4111-8111-111111111112',
         'Auth Bypass',
         'auth.bypass@example.com'
       )
     ) $$,
  '42501',
  NULL,
  'authenticated cannot execute intake RPC'
);

SELECT pg_temp.as_postgres();

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.submit_booking_enquiry(text,jsonb)',
    'EXECUTE'
  )
  AND NOT has_function_privilege(
    'authenticated',
    'public.submit_booking_enquiry(text,jsonb)',
    'EXECUTE'
  )
  AND has_function_privilege(
    'service_role',
    'public.submit_booking_enquiry(text,jsonb)',
    'EXECUTE'
  ),
  'intake RPC is service_role only'
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
      AND p.proname LIKE '%booking%'
      AND a.grantee = 0
      AND a.privilege_type = 'EXECUTE'
  ),
  'PUBLIC cannot execute booking private helpers'
);

SELECT is(
  (SELECT count(*)::integer
   FROM pg_proc p
   JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'submit_booking_enquiry'),
  1,
  'submit_booking_enquiry has no unsafe overload'
);

SELECT ok(
  (public.submit_booking_enquiry(
     'harbor-light',
     pg_temp.submit_payload(
       'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
       'Valid Visitor',
       'valid.visitor@example.com'
     )
   ) ->> 'ok')::boolean,
  'valid intake succeeds'
);

SELECT is(
  (SELECT count(*)::integer
   FROM public.booking_request_contacts
   WHERE customer_email = 'valid.visitor@example.com'),
  1,
  'one enquiry row for valid submit'
);

SELECT is(
  (public.submit_booking_enquiry(
     'harbor-light',
     pg_temp.submit_payload(
       'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
       'Valid Visitor',
       'valid.visitor@example.com'
     )
   ) ->> 'duplicate'),
  'true',
  'same key and payload is idempotent'
);

SELECT is(
  (SELECT count(*)::integer
   FROM public.booking_request_contacts
   WHERE customer_email = 'valid.visitor@example.com'),
  1,
  'idempotent retry does not insert a second enquiry'
);

SELECT is(
  public.submit_booking_enquiry(
    'harbor-light',
    jsonb_build_object(
      'idempotency_key', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      'display_name', 'Different Person',
      'email', 'other.visitor@example.com',
      'party_size', 2,
      'requested_local', pg_temp.future_local(),
      'locale', 'en'
    )
  ) ->> 'code',
  'conflict',
  'same key and different payload does not overwrite'
);

SELECT is(
  (SELECT count(*)::integer
   FROM public.booking_request_contacts
   WHERE customer_email = 'other.visitor@example.com'),
  0,
  'conflict payload is not stored'
);

SELECT throws_ok(
  $$ INSERT INTO public.booking_intake_idempotency (
       venue_id, key_hash, payload_hash, expires_at
     )
     SELECT venue_id, key_hash, payload_hash, pg_catalog.now() + interval '12 hours'
     FROM public.booking_intake_idempotency
     WHERE expires_at > pg_catalog.now()
     LIMIT 1 $$,
  '23505',
  NULL,
  'concurrent same-key insert is rejected'
);

SELECT is(
  public.submit_booking_enquiry(
    'draft-room',
    pg_temp.submit_payload(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
      'Draft Visitor',
      'draft.visitor@example.com'
    )
  ) ->> 'code',
  'unavailable',
  'draft venue intake is rejected'
);

SELECT is(
  public.submit_booking_enquiry(
    'trial-garden',
    pg_temp.submit_payload(
      'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
      'Paused Visitor',
      'paused.visitor@example.com'
    )
  ) ->> 'code',
  'unavailable',
  'paused intake is rejected'
);

SELECT is(
  public.submit_booking_enquiry(
    'trial-partial',
    pg_temp.submit_payload(
      'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
      'Partial Visitor',
      'partial.visitor@example.com'
    )
  ) ->> 'code',
  'unavailable',
  'not entitled intake is rejected'
);

SELECT is(
  public.submit_booking_enquiry(
    'silent-room',
    pg_temp.submit_payload(
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
      'Silent Visitor',
      'silent.visitor@example.com'
    )
  ) ->> 'code',
  'unavailable',
  'C16 suspended venue intake is rejected'
);

SELECT is(
  public.submit_booking_enquiry(
    'harbor-light',
    jsonb_build_object(
      'idempotency_key', 'ffffffff-ffff-4fff-8fff-fffffffffff1',
      'display_name', 'Too Many',
      'email', 'too.many@example.com',
      'party_size', 99,
      'requested_local', pg_temp.future_local(),
      'locale', 'en'
    )
  ) ->> 'code',
  'invalid_payload',
  'party size above settings is rejected'
);

SELECT ok(
  (public.submit_booking_enquiry(
     'restricted-room',
     pg_temp.submit_payload(
       '12121212-1212-4121-8121-121212121211',
       'Restricted Guest',
       'restricted.guest@example.com'
     )
   ) ->> 'ok')::boolean
  AND NOT (
    public.submit_booking_enquiry(
      'restricted-room',
      pg_temp.submit_payload(
        '12121212-1212-4121-8121-121212121211',
        'Restricted Guest',
        'restricted.guest@example.com'
      )
    ) ? 'id'
  ),
  'C16 restricted public intake stays open and never returns an enquiry id'
);

UPDATE public.venue_module_entitlements
SET revoked_at = pg_catalog.now()
WHERE venue_id = '00000000-0000-4000-8000-000000000101'
  AND module_key = 'booking_requests'
  AND grant_type = 'allow'
  AND revoked_at IS NULL;

SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.venue_module_settings
    WHERE venue_id = '00000000-0000-4000-8000-000000000101'
      AND module_key = 'booking_requests'
      AND is_enabled
      AND is_publicly_visible
  ),
  'harbor booking settings row still exists after entitlement revoke'
);

SELECT is(
  public.submit_booking_enquiry(
    'harbor-light',
    pg_temp.submit_payload(
      '13131313-1313-4131-8131-131313131311',
      'Stale Entitlement',
      'stale.entitlement@example.com'
    )
  ) ->> 'code',
  'unavailable',
  'stale form cannot submit after entitlement is revoked'
);

UPDATE public.venue_module_entitlements
SET revoked_at = NULL
WHERE venue_id = '00000000-0000-4000-8000-000000000101'
  AND module_key = 'booking_requests'
  AND grant_type = 'allow'
  AND revoked_at IS NOT NULL
  AND revoked_at >= pg_catalog.now() - interval '1 minute';

UPDATE public.venue_module_settings
SET is_enabled = false
WHERE venue_id = '00000000-0000-4000-8000-000000000101'
  AND module_key = 'booking_requests';

SELECT is(
  public.submit_booking_enquiry(
    'harbor-light',
    pg_temp.submit_payload(
      '14141414-1414-4141-8141-141414141411',
      'Disabled Module',
      'disabled.module@example.com'
    )
  ) ->> 'code',
  'unavailable',
  'stale form cannot submit after the module is disabled'
);

UPDATE public.venue_module_settings
SET
  is_enabled = true,
  settings = jsonb_set(settings, '{accepting_enquiries}', 'false'::jsonb, true)
WHERE venue_id = '00000000-0000-4000-8000-000000000101'
  AND module_key = 'booking_requests';

SELECT is(
  public.submit_booking_enquiry(
    'harbor-light',
    pg_temp.submit_payload(
      '15151515-1515-4151-8151-151515151511',
      'Paused Intake',
      'paused.intake@example.com'
    )
  ) ->> 'code',
  'unavailable',
  'stale form cannot submit after intake is paused'
);

UPDATE public.venue_module_settings
SET settings = jsonb_set(settings, '{accepting_enquiries}', 'true'::jsonb, true)
WHERE venue_id = '00000000-0000-4000-8000-000000000101'
  AND module_key = 'booking_requests';

UPDATE public.venues
SET
  publication_state = 'draft',
  platform_quarantined_at = pg_catalog.now(),
  platform_quarantine_reason = 'Booking intake regression',
  platform_quarantined_by = '00000000-0000-4000-8000-000000000001'
WHERE id = '00000000-0000-4000-8000-000000000101';

SELECT is(
  public.submit_booking_enquiry(
    'harbor-light',
    pg_temp.submit_payload(
      '16161616-1616-4161-8161-161616161611',
      'Quarantined Venue',
      'quarantined.venue@example.com'
    )
  ) ->> 'code',
  'unavailable',
  'stale form cannot submit after venue quarantine'
);

UPDATE public.venues
SET
  publication_state = 'published',
  platform_quarantined_at = NULL,
  platform_quarantine_reason = NULL,
  platform_quarantined_by = NULL
WHERE id = '00000000-0000-4000-8000-000000000101';

INSERT INTO public.booking_intake_windows (
  venue_id, window_start, submission_count
)
SELECT
  v.id,
  pg_catalog.date_trunc('hour', pg_catalog.now()),
  30
FROM public.venues v
WHERE v.slug = 'harbor-light'
ON CONFLICT (venue_id, window_start)
DO UPDATE SET submission_count = 30;

SELECT is(
  public.submit_booking_enquiry(
    'harbor-light',
    pg_temp.submit_payload(
      '17171717-1717-4171-8171-171717171711',
      'Quota Guest',
      'quota.guest@example.com'
    )
  ) ->> 'code',
  'unavailable',
  'hourly quota rejects the next submit atomically'
);

INSERT INTO public.booking_intake_windows (
  venue_id, window_start, submission_count
)
SELECT
  v.id,
  pg_catalog.date_trunc('hour', pg_catalog.now()),
  1
FROM public.venues v
WHERE v.slug = 'harbor-light'
ON CONFLICT (venue_id, window_start)
DO UPDATE SET submission_count = 1;

SELECT ok(
  pg_catalog.pg_get_functiondef(
    'public.submit_booking_enquiry(text,jsonb)'::regprocedure
  ) LIKE '%booking_public_intake_open%'
  AND pg_catalog.pg_get_functiondef(
    'public.submit_booking_enquiry(text,jsonb)'::regprocedure
  ) LIKE '%pg_advisory_xact_lock%'
  AND pg_catalog.pg_get_functiondef(
    'app_private.booking_public_intake_open(uuid)'::regprocedure
  ) LIKE '%module_is_entitled%'
  AND pg_catalog.pg_get_functiondef(
    'app_private.booking_public_intake_open(uuid)'::regprocedure
  ) LIKE '%venue_is_publicly_visible%',
  'definer intake re-checks entitlement, visibility and locks duplicates'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000010');

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.booking_requests
    WHERE id = '00000000-0000-4000-8000-000000000601'
  ),
  'harbor owner can read own queue'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.booking_request_contacts
    WHERE booking_request_id = '00000000-0000-4000-8000-000000000601'
  ),
  'harbor owner can read own customer details'
);

SELECT is(
  (SELECT count(*)::integer FROM public.booking_requests
   WHERE venue_id = '00000000-0000-4000-8000-000000000201'),
  0,
  'harbor owner cannot read Night Orchid enquiries'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000023');

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.booking_requests
    WHERE venue_id = '00000000-0000-4000-8000-000000000201'
  ),
  'booking manager can read Night Orchid queue'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.booking_request_contacts
    WHERE venue_id = '00000000-0000-4000-8000-000000000201'
  ),
  'booking manager can read Night Orchid contacts'
);

SELECT is(
  (SELECT count(*)::integer FROM public.booking_requests
   WHERE venue_id = '00000000-0000-4000-8000-000000000101'),
  0,
  'booking manager cannot read Harbor Light enquiries'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000022');

SELECT is(
  (SELECT count(*)::integer FROM public.booking_requests
   WHERE venue_id = '00000000-0000-4000-8000-000000000201'),
  0,
  'content editor cannot read booking queue'
);

SELECT is(
  (SELECT count(*)::integer FROM public.booking_request_contacts),
  0,
  'content editor cannot read booking contacts'
);

SELECT is(
  public.review_booking_enquiry(
    '00000000-0000-4000-8000-000000000605',
    1
  ) ->> 'code',
  'forbidden',
  'editor cannot review enquiries'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000024');

SELECT is(
  (SELECT count(*)::integer FROM public.booking_requests),
  0,
  'staff cannot read booking queue'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000026');

SELECT is(
  (SELECT count(*)::integer FROM public.booking_requests),
  0,
  'deactivated actor cannot read bookings'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000001');

SELECT is(
  (SELECT count(*)::integer FROM public.booking_request_contacts
   WHERE venue_id = '00000000-0000-4000-8000-000000000101'),
  0,
  'platform admin without support session cannot read harbor contacts (C11)'
);

SELECT is(
  public.close_booking_enquiry(
    '00000000-0000-4000-8000-000000000601',
    'handled',
    1
  ) ->> 'code',
  'forbidden',
  'platform admin without write session cannot close (C19)'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000020');

SELECT is(
  (SELECT count(*)::integer FROM public.booking_request_contacts
   WHERE venue_id = '00000000-0000-4000-8000-000000000209'),
  0,
  'C17 expired entitlement blocks leftover customer reads'
);

SELECT pg_temp.as_postgres();

INSERT INTO public.support_sessions (
  operator_user_id, target_business_id, target_venue_id, reason, mode,
  write_granted_by, write_granted_at, write_expires_at, started_at, expires_at
) VALUES (
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000100',
  '00000000-0000-4000-8000-000000000101',
  'Booking C11/C19 test',
  'write',
  '00000000-0000-4000-8000-000000000001',
  now(),
  now() + interval '1 hour',
  now(),
  now() + interval '4 hours'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000001');

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.booking_request_contacts
    WHERE booking_request_id = '00000000-0000-4000-8000-000000000601'
  ),
  'C11 support session can read harbor contacts'
);

SELECT is(
  (public.close_booking_enquiry(
     '00000000-0000-4000-8000-0000000006c1',
     'handled',
     (
       SELECT row_version
       FROM public.booking_requests
       WHERE id = '00000000-0000-4000-8000-0000000006c1'
     )
   ) ->> 'ok')::boolean,
  true,
  'C19 write session can close an enquiry'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000021');

SELECT is(
  (public.review_booking_enquiry(
     '00000000-0000-4000-8000-000000000605',
     1
   ) ->> 'ok')::boolean,
  true,
  'venue manager can review a new enquiry'
);

SELECT is(
  public.review_booking_enquiry(
    '00000000-0000-4000-8000-000000000605',
    1
  ) ->> 'code',
  'conflict',
  'stale row_version is rejected'
);

SELECT is(
  (public.close_booking_enquiry(
     '00000000-0000-4000-8000-000000000605',
     'handled',
     2
   ) ->> 'ok')::boolean,
  true,
  'manager can close as handled'
);

SELECT is(
  (SELECT state FROM public.booking_requests
   WHERE id = '00000000-0000-4000-8000-000000000605'),
  'closed',
  'closed state persisted'
);

SELECT is(
  (public.reopen_booking_enquiry(
     '00000000-0000-4000-8000-000000000605',
     3
   ) ->> 'ok')::boolean,
  true,
  'authorized reopen succeeds'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'booking_request_events'
      AND column_name IN (
        'customer_display_name',
        'customer_email',
        'customer_message'
      )
  ),
  'history table has no customer payload columns'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM public.audit_log
    WHERE target_table = 'booking_requests'
      AND (
        summary ILIKE '%@example.com%'
        OR COALESCE(previous_state::text, '') ILIKE '%@example.com%'
        OR COALESCE(resulting_state::text, '') ILIKE '%@example.com%'
      )
  ),
  'audit metadata has no customer email'
);

SELECT pg_temp.as_postgres();

SELECT throws_ok(
  $$ UPDATE public.booking_requests
     SET venue_id = '00000000-0000-4000-8000-000000000201'
     WHERE id = '00000000-0000-4000-8000-000000000601' $$,
  '42501',
  NULL,
  'venue_id cannot change on ordinary update'
);

SELECT throws_ok(
  $$ UPDATE public.booking_request_events SET action = 'created' $$,
  '25006',
  NULL,
  'history is append-only'
);

SELECT ok(
  (SELECT prosecdef
   FROM pg_proc p
   JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'submit_booking_enquiry'),
  'intake RPC is SECURITY DEFINER'
);

SELECT ok(
  (SELECT proconfig::text LIKE '%search_path=%'
   FROM pg_proc p
   JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'submit_booking_enquiry'),
  'intake RPC sets search_path'
);

SELECT ok(
  (
    SELECT bool_and(COALESCE(p.proconfig, ARRAY[]::text[])::text LIKE '%search_path=%')
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'submit_booking_enquiry',
        'review_booking_enquiry',
        'close_booking_enquiry',
        'reopen_booking_enquiry',
        'update_booking_module_settings'
      )
  ),
  'all public booking RPCs set search_path'
);

SELECT ok(
  pg_catalog.pg_get_functiondef(
    'app_private.may_read_booking_queue(uuid)'::regprocedure
  ) LIKE '%view_bookings%'
  AND pg_catalog.pg_get_functiondef(
    'app_private.may_read_booking_queue(uuid)'::regprocedure
  ) NOT LIKE '%view_booking_customer_details%'
  AND pg_catalog.pg_get_functiondef(
    'app_private.may_read_booking_customer(uuid)'::regprocedure
  ) LIKE '%view_booking_customer_details%'
  AND pg_catalog.pg_get_functiondef(
    'app_private.may_read_booking_customer(uuid)'::regprocedure
  ) LIKE '%may_read_booking_queue%',
  'queue and customer helpers stay separately gated'
);

CREATE EXTENSION IF NOT EXISTS dblink WITH SCHEMA extensions;

CREATE FUNCTION pg_temp.booking_dblink_conn()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  listen_host text := host(inet_server_addr());
BEGIN
  -- Loopback is trust-auth. Postgres 17 dblink then rejects the session
  -- because the local `postgres` role is not a superuser and the password
  -- in the connstring is not used. Reach the db over Docker DNS so pg_hba
  -- applies scram-sha-256.
  IF listen_host IS NULL OR listen_host IN ('127.0.0.1', '::1') THEN
    listen_host := 'db.supabase.internal';
  END IF;

  RETURN format(
    'dbname=%s user=postgres password=postgres host=%s port=%s',
    current_database(),
    listen_host,
    current_setting('port')
  );
END;
$$;

CREATE FUNCTION pg_temp.booking_submit_sql(
  p_key text,
  p_name text,
  p_email text,
  p_requested_local text
)
RETURNS text
LANGUAGE sql
AS $$
  SELECT format(
    $q$SELECT public.submit_booking_enquiry(
      'night-orchid',
      jsonb_build_object(
        'idempotency_key', %L,
        'display_name', %L,
        'email', %L,
        'party_size', 2,
        'requested_local', %L,
        'locale', 'en',
        'message', 'Two-session regression.'
      )
    )::text$q$,
    p_key,
    p_name,
    p_email,
    p_requested_local
  );
$$;

CREATE FUNCTION pg_temp.booking_two_session(p_sql_a text, p_sql_b text)
RETURNS TABLE (session_key text, result jsonb)
LANGUAGE plpgsql
AS $$
DECLARE
  conn text := pg_temp.booking_dblink_conn();
  raw_a text;
  raw_b text;
BEGIN
  BEGIN
    PERFORM extensions.dblink_disconnect('vb_bk_a');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  BEGIN
    PERFORM extensions.dblink_disconnect('vb_bk_b');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  PERFORM extensions.dblink_connect('vb_bk_a', conn);
  PERFORM extensions.dblink_connect('vb_bk_b', conn);
  PERFORM extensions.dblink_send_query('vb_bk_a', p_sql_a);
  PERFORM extensions.dblink_send_query('vb_bk_b', p_sql_b);

  SELECT r.result INTO raw_a
  FROM extensions.dblink_get_result('vb_bk_a') AS r(result text);
  SELECT r.result INTO raw_b
  FROM extensions.dblink_get_result('vb_bk_b') AS r(result text);

  PERFORM extensions.dblink_disconnect('vb_bk_a');
  PERFORM extensions.dblink_disconnect('vb_bk_b');

  session_key := 'a';
  result := raw_a::jsonb;
  RETURN NEXT;
  session_key := 'b';
  result := raw_b::jsonb;
  RETURN NEXT;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    PERFORM extensions.dblink_disconnect('vb_bk_a');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  BEGIN
    PERFORM extensions.dblink_disconnect('vb_bk_b');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RAISE;
END;
$$;

SELECT pg_temp.as_postgres();

-- Payload hash includes requested_local, so both sessions must send the same
-- clock value. Keys and emails are generated per run so leftover committed
-- dblink rows from a previous attempt cannot collide.
CREATE TABLE pg_temp.booking_race (
  kind text PRIMARY KEY,
  key uuid NOT NULL,
  email text NOT NULL,
  requested_local text NOT NULL
);

INSERT INTO pg_temp.booking_race (kind, key, email, requested_local)
SELECT
  kind,
  gen_random_uuid(),
  format(
    'concurrent.%s.%s.booking@example.com',
    kind,
    replace(gen_random_uuid()::text, '-', '')
  ),
  pg_temp.future_local()
FROM (VALUES ('same'), ('quota_a'), ('quota_b')) AS k(kind);

CREATE TABLE pg_temp.booking_same_key_result AS
SELECT *
FROM pg_temp.booking_two_session(
  pg_temp.booking_submit_sql(
    (SELECT key::text FROM pg_temp.booking_race WHERE kind = 'same'),
    'Concurrent Same',
    (SELECT email FROM pg_temp.booking_race WHERE kind = 'same'),
    (SELECT requested_local FROM pg_temp.booking_race WHERE kind = 'same')
  ),
  pg_temp.booking_submit_sql(
    (SELECT key::text FROM pg_temp.booking_race WHERE kind = 'same'),
    'Concurrent Same',
    (SELECT email FROM pg_temp.booking_race WHERE kind = 'same'),
    (SELECT requested_local FROM pg_temp.booking_race WHERE kind = 'same')
  )
);

SELECT ok(
  (
    SELECT bool_and((result ->> 'ok')::boolean)
    FROM pg_temp.booking_same_key_result
  )
  AND (
    SELECT count(*)::integer
    FROM public.booking_request_contacts
    WHERE customer_email = (
      SELECT email FROM pg_temp.booking_race WHERE kind = 'same'
    )
  ) = 1,
  'two sessions with the same idempotency key create one enquiry'
);

SELECT extensions.dblink_exec(
  pg_temp.booking_dblink_conn(),
  $w$
    INSERT INTO public.booking_intake_windows (
      venue_id, window_start, submission_count
    )
    SELECT
      v.id,
      pg_catalog.date_trunc('hour', pg_catalog.now()),
      29
    FROM public.venues v
    WHERE v.slug = 'night-orchid'
    ON CONFLICT (venue_id, window_start)
    DO UPDATE SET submission_count = 29
  $w$
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.booking_request_contacts
    WHERE customer_email IN (
      SELECT email
      FROM pg_temp.booking_race
      WHERE kind IN ('quota_a', 'quota_b')
    )
  ),
  0,
  'quota two-session identifiers are unused before the race'
);

CREATE TABLE pg_temp.booking_quota_result AS
SELECT *
FROM pg_temp.booking_two_session(
  pg_temp.booking_submit_sql(
    (SELECT key::text FROM pg_temp.booking_race WHERE kind = 'quota_a'),
    'Concurrent Quota A',
    (SELECT email FROM pg_temp.booking_race WHERE kind = 'quota_a'),
    (SELECT requested_local FROM pg_temp.booking_race WHERE kind = 'quota_a')
  ),
  pg_temp.booking_submit_sql(
    (SELECT key::text FROM pg_temp.booking_race WHERE kind = 'quota_b'),
    'Concurrent Quota B',
    (SELECT email FROM pg_temp.booking_race WHERE kind = 'quota_b'),
    (SELECT requested_local FROM pg_temp.booking_race WHERE kind = 'quota_b')
  )
);

SELECT ok(
  (
    SELECT count(*) FILTER (WHERE (result ->> 'ok')::boolean)::integer
      + count(*) FILTER (WHERE result ->> 'code' = 'unavailable')::integer
    FROM pg_temp.booking_quota_result
  ) = 2
  AND (
    SELECT count(*)::integer
    FROM public.booking_request_contacts
    WHERE customer_email IN (
      SELECT email
      FROM pg_temp.booking_race
      WHERE kind IN ('quota_a', 'quota_b')
    )
  ) = 1
  AND (
    SELECT w.submission_count
    FROM public.booking_intake_windows w
    JOIN public.venues v ON v.id = w.venue_id
    WHERE v.slug = 'night-orchid'
      AND w.window_start = pg_catalog.date_trunc('hour', pg_catalog.now())
  ) = 30,
  'two sessions cannot exceed the hourly quota'
);

SELECT extensions.dblink_exec(
  pg_temp.booking_dblink_conn(),
  $w$
    UPDATE public.booking_intake_windows w
    SET submission_count = 1
    FROM public.venues v
    WHERE v.id = w.venue_id
      AND v.slug = 'night-orchid'
      AND w.window_start = pg_catalog.date_trunc('hour', pg_catalog.now())
  $w$
);

SELECT finish();

ROLLBACK;
