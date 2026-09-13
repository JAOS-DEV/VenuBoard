-- Venue public profile, contacts, hours, publication, RLS and definers.

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

CREATE FUNCTION pg_temp.updated_at(p_venue uuid)
RETURNS timestamptz
LANGUAGE sql
AS $$
  SELECT v.updated_at FROM public.venues v WHERE v.id = p_venue;
$$;

GRANT EXECUTE ON FUNCTION pg_temp.updated_at(uuid) TO anon, authenticated;

CREATE FUNCTION pg_temp.closed_week()
RETURNS jsonb
LANGUAGE sql
AS $$
  SELECT jsonb_build_array(
    jsonb_build_object('day', 1, 'closed', true, 'intervals', '[]'::jsonb),
    jsonb_build_object('day', 2, 'closed', true, 'intervals', '[]'::jsonb),
    jsonb_build_object('day', 3, 'closed', true, 'intervals', '[]'::jsonb),
    jsonb_build_object('day', 4, 'closed', true, 'intervals', '[]'::jsonb),
    jsonb_build_object('day', 5, 'closed', true, 'intervals', '[]'::jsonb),
    jsonb_build_object('day', 6, 'closed', true, 'intervals', '[]'::jsonb),
    jsonb_build_object('day', 7, 'closed', true, 'intervals', '[]'::jsonb)
  );
$$;

GRANT EXECUTE ON FUNCTION pg_temp.closed_week() TO anon, authenticated;

CREATE FUNCTION pg_temp.next_local_iso_day(p_dow integer)
RETURNS date
LANGUAGE sql
STABLE
AS $$
  SELECT g.ts::date
  FROM generate_series(
    (pg_catalog.now() AT TIME ZONE 'Asia/Bangkok')::date,
    (pg_catalog.now() AT TIME ZONE 'Asia/Bangkok')::date + 6,
    interval '1 day'
  ) AS g(ts)
  WHERE EXTRACT(ISODOW FROM g.ts)::integer = p_dow
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION pg_temp.next_local_iso_day(integer)
  TO anon, authenticated;

CREATE FUNCTION pg_temp.week_fri_overnight_sat_closed()
RETURNS jsonb
LANGUAGE sql
AS $$
  SELECT jsonb_build_array(
    jsonb_build_object('day', 1, 'closed', true, 'intervals', '[]'::jsonb),
    jsonb_build_object('day', 2, 'closed', true, 'intervals', '[]'::jsonb),
    jsonb_build_object('day', 3, 'closed', true, 'intervals', '[]'::jsonb),
    jsonb_build_object(
      'day', 4, 'closed', false,
      'intervals', jsonb_build_array(
        jsonb_build_object(
          'opens', '18:00', 'closes', '02:00', 'closes_next_day', true
        )
      )
    ),
    jsonb_build_object(
      'day', 5, 'closed', false,
      'intervals', jsonb_build_array(
        jsonb_build_object(
          'opens', '18:00', 'closes', '02:00', 'closes_next_day', true
        )
      )
    ),
    jsonb_build_object('day', 6, 'closed', true, 'intervals', '[]'::jsonb),
    jsonb_build_object('day', 7, 'closed', true, 'intervals', '[]'::jsonb)
  );
$$;

GRANT EXECUTE ON FUNCTION pg_temp.week_fri_overnight_sat_closed()
  TO anon, authenticated;

SELECT has_table('public', 'venue_contacts', 'venue_contacts exists');
SELECT has_table('public', 'venue_opening_hours', 'venue_opening_hours exists');
SELECT has_table('public', 'venue_closed_weekdays', 'venue_closed_weekdays exists');
SELECT has_table(
  'public',
  'venue_hours_exceptions',
  'venue_hours_exceptions exists'
);
SELECT has_table(
  'public',
  'venue_hours_exception_intervals',
  'exception intervals exist'
);

SELECT ok(
  (
    SELECT relrowsecurity AND relforcerowsecurity
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'venue_contacts'
  ),
  'venue_contacts has RLS forced'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.venue_hours_exception_intervals'::regclass
      AND contype = 'f'
      AND pg_get_constraintdef(oid) LIKE '%(exception_id, venue_id)%'
  ),
  'exception intervals use an ADR-037 composite foreign key'
);

SELECT pg_temp.impersonate_anon();

SELECT throws_ok(
  $$ SELECT id FROM public.venue_contacts $$,
  '42501',
  NULL,
  'anon cannot select venue_contacts'
);

SELECT is(
  public.list_public_venue_profile('draft-room', 'en')->>'available',
  'false',
  'anonymous users cannot preview unpublished venues'
);

SELECT ok(
  (public.list_public_venue_profile('harbor-light', 'en')->>'available')::boolean
  AND (public.list_public_venue_profile('harbor-light', 'en')->>'preview') = 'false'
  AND public.list_public_venue_profile('harbor-light', 'en')::text
    NOT LIKE '%Private fixture note%'
  AND public.list_public_venue_profile('harbor-light', 'en')::text
    NOT ILIKE '%internal_note%',
  'public harbor profile omits private exception notes'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(
      public.list_public_venue_profile('harbor-light', 'en')->'exceptions'
    ) AS e
    WHERE e ? 'internal_note'
  ),
  'public exception objects have no internal_note key'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000020');

SELECT is(
  public.list_public_venue_profile('draft-room', 'en')->>'preview',
  'true',
  'authorised tenant can privately preview draft-room'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000010');

SELECT is(
  public.list_public_venue_profile('draft-room', 'en')->>'available',
  'false',
  'unrelated signed-in Harbor owner cannot preview Draft Room'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000020');

SELECT is_empty(
  $$ SELECT venue_id FROM public.venue_contacts
     WHERE venue_id = '00000000-0000-4000-8000-000000000101' $$,
  'cross-tenant cannot read Harbor contacts'
);

SELECT is(
  public.save_venue_public_profile(
    '00000000-0000-4000-8000-000000000101',
    jsonb_build_object(
      'expected_updated_at', pg_temp.updated_at('00000000-0000-4000-8000-000000000101'),
      'name', 'Hijack'
    )
  )->>'code',
  'forbidden',
  'cross-venue profile write is denied'
);

SELECT pg_temp.as_postgres();

CREATE TEMP TABLE harbor_profile_snap AS
SELECT
  v.updated_at,
  v.name,
  v.slug,
  v.timezone,
  v.content_classification,
  v.platform_quarantined_at,
  v.opening_hours_mode,
  t.tagline AS tagline_en,
  t.directions AS directions_en,
  (
    SELECT count(*)::integer
    FROM public.venue_contacts c
    WHERE c.venue_id = v.id
  ) AS contacts,
  (
    SELECT count(*)::integer
    FROM public.venue_opening_hours h
    WHERE h.venue_id = v.id
  ) AS hours_rows,
  (
    SELECT count(*)::integer
    FROM public.venue_hours_exceptions e
    WHERE e.venue_id = v.id
  ) AS exceptions,
  (
    SELECT count(*)::integer
    FROM public.audit_log a
    WHERE a.venue_id = v.id
  ) AS audits
FROM public.venues v
JOIN public.venue_translations t
  ON t.venue_id = v.id AND t.locale = 'en'
WHERE v.id = '00000000-0000-4000-8000-000000000101';

GRANT SELECT ON TABLE harbor_profile_snap TO authenticated, anon;

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000010');

SELECT is(
  public.save_venue_public_profile(
    '00000000-0000-4000-8000-000000000201',
    jsonb_build_object(
      'expected_updated_at', pg_temp.updated_at('00000000-0000-4000-8000-000000000201'),
      'name', 'Orchid hijack'
    )
  )->>'code',
  'forbidden',
  'Harbor owner staff at Night Orchid cannot manage that venue profile'
);

SELECT is(
  public.save_venue_opening_hours(
    '00000000-0000-4000-8000-000000000101',
    jsonb_build_object(
      'expected_updated_at', pg_temp.updated_at('00000000-0000-4000-8000-000000000101'),
      'mode', 'scheduled',
      'week', jsonb_build_array(
        jsonb_build_object(
          'day', 1, 'closed', false,
          'intervals', jsonb_build_array(
            jsonb_build_object('opens', '10:00', 'closes', '14:00', 'closes_next_day', false),
            jsonb_build_object('opens', '13:00', 'closes', '16:00', 'closes_next_day', false)
          )
        ),
        jsonb_build_object('day', 2, 'closed', true, 'intervals', '[]'::jsonb),
        jsonb_build_object('day', 3, 'closed', true, 'intervals', '[]'::jsonb),
        jsonb_build_object('day', 4, 'closed', true, 'intervals', '[]'::jsonb),
        jsonb_build_object('day', 5, 'closed', true, 'intervals', '[]'::jsonb),
        jsonb_build_object('day', 6, 'closed', true, 'intervals', '[]'::jsonb),
        jsonb_build_object('day', 7, 'closed', true, 'intervals', '[]'::jsonb)
      ),
      'exceptions', '[]'::jsonb
    )
  )->>'code',
  'invalid_payload',
  'overlapping same-day intervals are rejected'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.venue_opening_hours
    WHERE venue_id = '00000000-0000-4000-8000-000000000101'
      AND day_of_week = 2
  ),
  2,
  'rejected overlap does not clear Harbor split Tuesday hours'
);

SELECT is(
  public.save_venue_opening_hours(
    '00000000-0000-4000-8000-000000000101',
    jsonb_build_object(
      'expected_updated_at', pg_temp.updated_at('00000000-0000-4000-8000-000000000101'),
      'mode', 'scheduled',
      'week', jsonb_build_array(
        jsonb_build_object('day', 1, 'closed', true, 'intervals', '[]'::jsonb),
        jsonb_build_object('day', 2, 'closed', true, 'intervals', '[]'::jsonb),
        jsonb_build_object('day', 3, 'closed', true, 'intervals', '[]'::jsonb),
        jsonb_build_object('day', 4, 'closed', true, 'intervals', '[]'::jsonb),
        jsonb_build_object(
          'day', 5, 'closed', false,
          'intervals', jsonb_build_array(
            jsonb_build_object('opens', '18:00', 'closes', '02:00', 'closes_next_day', true)
          )
        ),
        jsonb_build_object(
          'day', 6, 'closed', false,
          'intervals', jsonb_build_array(
            jsonb_build_object('opens', '01:00', 'closes', '04:00', 'closes_next_day', false)
          )
        ),
        jsonb_build_object('day', 7, 'closed', true, 'intervals', '[]'::jsonb)
      ),
      'exceptions', '[]'::jsonb
    )
  )->>'code',
  'invalid_payload',
  'overnight spillover onto the next morning is rejected'
);

SELECT pg_temp.as_postgres();

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.venue_opening_hours
    WHERE venue_id = '00000000-0000-4000-8000-000000000101'
  ),
  (SELECT hours_rows FROM harbor_profile_snap),
  'invalid hours roll back weekly interval writes'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.venue_hours_exceptions
    WHERE venue_id = '00000000-0000-4000-8000-000000000101'
  ),
  (SELECT exceptions FROM harbor_profile_snap),
  'invalid hours roll back exception writes'
);

SELECT is(
  (
    SELECT v.updated_at
    FROM public.venues v
    WHERE v.id = '00000000-0000-4000-8000-000000000101'
  ),
  (SELECT updated_at FROM harbor_profile_snap),
  'invalid hours do not bump venues.updated_at'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.audit_log
    WHERE venue_id = '00000000-0000-4000-8000-000000000101'
  ),
  (SELECT audits FROM harbor_profile_snap),
  'invalid hours do not write audit records'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000010');

SELECT is(
  public.save_venue_public_profile(
    '00000000-0000-4000-8000-000000000101',
    jsonb_build_object(
      'expected_updated_at', pg_temp.updated_at('00000000-0000-4000-8000-000000000101'),
      'name', 'Hijacked Harbor',
      'name_en', 'Hijacked Harbor',
      'tagline_en', 'Hijacked tagline',
      'directions_en', 'Hijacked directions',
      'contacts', jsonb_build_array(
        jsonb_build_object('type', 'website', 'value', 'javascript:alert(1)')
      )
    )
  )->>'code',
  'invalid_payload',
  'invalid website contact is rejected'
);

SELECT pg_temp.as_postgres();

SELECT is(
  (
    SELECT v.name
    FROM public.venues v
    WHERE v.id = '00000000-0000-4000-8000-000000000101'
  ),
  (SELECT name FROM harbor_profile_snap),
  'invalid contact rolls back venue name'
);

SELECT is(
  (
    SELECT t.tagline
    FROM public.venue_translations t
    WHERE t.venue_id = '00000000-0000-4000-8000-000000000101'
      AND t.locale = 'en'
  ),
  (SELECT tagline_en FROM harbor_profile_snap),
  'invalid contact rolls back translations'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.venue_contacts
    WHERE venue_id = '00000000-0000-4000-8000-000000000101'
  ),
  (SELECT contacts FROM harbor_profile_snap),
  'invalid contact rolls back contact writes'
);

SELECT is(
  (
    SELECT v.updated_at
    FROM public.venues v
    WHERE v.id = '00000000-0000-4000-8000-000000000101'
  ),
  (SELECT updated_at FROM harbor_profile_snap),
  'invalid contact does not bump venues.updated_at'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.audit_log
    WHERE venue_id = '00000000-0000-4000-8000-000000000101'
  ),
  (SELECT audits FROM harbor_profile_snap),
  'invalid contact does not write audit records'
);

SELECT throws_ok(
  $$ INSERT INTO public.venue_opening_hours (
       venue_id, day_of_week, sort_order, opens_local, closes_local, closes_next_day
     ) VALUES (
       '00000000-0000-4000-8000-000000000101', 1, 2, '11:00', '14:00', false
     ) $$,
  '23P01',
  NULL,
  'direct writes cannot create overlapping weekly intervals'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000022');

SELECT is(
  public.save_venue_public_profile(
    '00000000-0000-4000-8000-000000000201',
    jsonb_build_object(
      'expected_updated_at', pg_temp.updated_at('00000000-0000-4000-8000-000000000201'),
      'name', 'Editor hijack'
    )
  )->>'code',
  'forbidden',
  'content editor cannot manage_venue'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000023');

SELECT is(
  public.save_venue_opening_hours(
    '00000000-0000-4000-8000-000000000201',
    jsonb_build_object(
      'expected_updated_at', pg_temp.updated_at('00000000-0000-4000-8000-000000000201'),
      'mode', 'unknown',
      'week', pg_temp.closed_week(),
      'exceptions', '[]'::jsonb
    )
  )->>'code',
  'forbidden',
  'booking manager cannot manage hours'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000024');

SELECT is(
  public.set_venue_publication(
    '00000000-0000-4000-8000-000000000201',
    jsonb_build_object(
      'expected_updated_at', pg_temp.updated_at('00000000-0000-4000-8000-000000000201'),
      'publication_state', 'draft'
    )
  )->>'code',
  'forbidden',
  'staff cannot publish or unpublish the venue site'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000026');

SELECT is(
  public.save_venue_public_profile(
    '00000000-0000-4000-8000-000000000201',
    jsonb_build_object(
      'expected_updated_at', pg_temp.updated_at('00000000-0000-4000-8000-000000000201'),
      'name', 'Deactivated'
    )
  )->>'code',
  'forbidden',
  'deactivated users cannot edit profiles'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000020');

SELECT is(
  public.save_venue_public_profile(
    '00000000-0000-4000-8000-000000000203',
    jsonb_build_object(
      'expected_updated_at', pg_temp.updated_at('00000000-0000-4000-8000-000000000203'),
      'name', 'Restricted Room'
    )
  )->>'code',
  'forbidden',
  'C16: restricted subscription blocks profile writes'
);

SELECT is(
  public.save_venue_opening_hours(
    '00000000-0000-4000-8000-000000000201',
    jsonb_build_object(
      'expected_updated_at', pg_temp.updated_at('00000000-0000-4000-8000-000000000201'),
      'mode', 'scheduled',
      'week', jsonb_build_array(
        jsonb_build_object('day', 1, 'closed', true, 'intervals', '[]'::jsonb),
        jsonb_build_object('day', 2, 'closed', true, 'intervals', '[]'::jsonb),
        jsonb_build_object('day', 3, 'closed', true, 'intervals', '[]'::jsonb),
        jsonb_build_object(
          'day', 4, 'closed', false,
          'intervals', jsonb_build_array(
            jsonb_build_object('opens', '18:00', 'closes', '02:00', 'closes_next_day', true)
          )
        ),
        jsonb_build_object(
          'day', 5, 'closed', false,
          'intervals', jsonb_build_array(
            jsonb_build_object('opens', '18:00', 'closes', '02:00', 'closes_next_day', true)
          )
        ),
        jsonb_build_object(
          'day', 6, 'closed', false,
          'intervals', jsonb_build_array(
            jsonb_build_object('opens', '18:00', 'closes', '02:00', 'closes_next_day', true)
          )
        ),
        jsonb_build_object('day', 7, 'closed', true, 'intervals', '[]'::jsonb)
      ),
      'exceptions', '[]'::jsonb
    )
  )->>'ok',
  'true',
  'C17: core_profile hours writes do not require other module entitlements'
);

SELECT throws_ok(
  $$ INSERT INTO public.venue_opening_hours (
       venue_id, day_of_week, sort_order, opens_local, closes_local, closes_next_day
     ) VALUES (
       '00000000-0000-4000-8000-000000000201', 6, 2, '01:00', '04:00', false
     ) $$,
  '23P01',
  NULL,
  'direct writes cannot overlap Friday overnight onto Saturday morning'
);

SELECT is(
  public.save_venue_opening_hours(
    '00000000-0000-4000-8000-000000000201',
    jsonb_build_object(
      'expected_updated_at', pg_temp.updated_at('00000000-0000-4000-8000-000000000201'),
      'mode', 'scheduled',
      'week', pg_temp.week_fri_overnight_sat_closed(),
      'exceptions', '[]'::jsonb
    )
  )->>'ok',
  'true',
  'weekly closed Saturday is stored beside Friday overnight'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.venue_opening_hours
    WHERE venue_id = '00000000-0000-4000-8000-000000000201'
      AND day_of_week = 5
      AND closes_next_day
      AND opens_local = TIME '18:00'
      AND closes_local = TIME '02:00'
  )
  AND EXISTS (
    SELECT 1
    FROM public.venue_closed_weekdays
    WHERE venue_id = '00000000-0000-4000-8000-000000000201'
      AND day_of_week = 6
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.venue_opening_hours
    WHERE venue_id = '00000000-0000-4000-8000-000000000201'
      AND day_of_week = 6
  ),
  'weekly closed Saturday does not truncate stored Friday overnight'
);

SELECT is(
  public.save_venue_opening_hours(
    '00000000-0000-4000-8000-000000000201',
    jsonb_build_object(
      'expected_updated_at', pg_temp.updated_at('00000000-0000-4000-8000-000000000201'),
      'mode', 'scheduled',
      'week', pg_temp.week_fri_overnight_sat_closed(),
      'exceptions', jsonb_build_array(
        jsonb_build_object(
          'date', pg_temp.next_local_iso_day(6)::text,
          'closed', true,
          'intervals', '[]'::jsonb,
          'internal_note', 'Private Saturday fixture note'
        )
      )
    )
  )->>'ok',
  'true',
  'Saturday exception replaces that local date'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.venue_opening_hours
    WHERE venue_id = '00000000-0000-4000-8000-000000000201'
      AND day_of_week = 5
      AND closes_next_day
  )
  AND EXISTS (
    SELECT 1
    FROM public.venue_hours_exceptions
    WHERE venue_id = '00000000-0000-4000-8000-000000000201'
      AND exception_date = pg_temp.next_local_iso_day(6)
      AND is_closed
      AND internal_note = 'Private Saturday fixture note'
  ),
  'Saturday exception leaves Friday overnight stored'
);

SELECT pg_temp.impersonate_anon();

SELECT ok(
  (
    SELECT bool_or(
      e->>'date' = pg_temp.next_local_iso_day(6)::text
      AND (e->>'closed')::boolean
    )
    FROM jsonb_array_elements(
      public.list_public_venue_profile('night-orchid', 'en')->'exceptions'
    ) AS e
  )
  AND public.list_public_venue_profile('night-orchid', 'en')::text
    NOT LIKE '%Private Saturday fixture note%'
  AND public.list_public_venue_profile('night-orchid', 'en')::text
    NOT ILIKE '%internal_note%',
  'public Night Orchid exceptions omit private notes and show the closed Saturday'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000020');

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000001');

SELECT is(
  public.save_venue_public_profile(
    '00000000-0000-4000-8000-000000000101',
    jsonb_build_object(
      'expected_updated_at', pg_temp.updated_at('00000000-0000-4000-8000-000000000101'),
      'name', 'Platform hijack'
    )
  )->>'code',
  'forbidden',
  'C19: platform admin without support write cannot edit tenant profile'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000002');

SELECT is(
  public.save_venue_branding(
    '00000000-0000-4000-8000-000000000101',
    jsonb_build_object(
      'theme_key', 'midnight',
      'font_key', 'system',
      'primary_color', '#111111',
      'secondary_color', '#222222',
      'accent_color', '#333333',
      'background_color', '#FFFFFF',
      'text_color', '#111111'
    )
  )->>'code',
  'forbidden',
  'platform support cannot edit branding without write authorisation'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000010');

SELECT is(
  (
    SELECT timezone
    FROM public.venues
    WHERE id = '00000000-0000-4000-8000-000000000101'
  ),
  'Asia/Bangkok',
  'profile RPC does not change timezone'
);

SELECT is(
  public.save_venue_public_profile(
    '00000000-0000-4000-8000-000000000101',
    jsonb_build_object(
      'expected_updated_at', '2000-01-01T00:00:00Z',
      'name', 'Harbor Light'
    )
  )->>'code',
  'conflict',
  'stale expected_updated_at is rejected'
);

SELECT ok(
  (public.save_venue_public_profile(
    '00000000-0000-4000-8000-000000000101',
    jsonb_build_object(
      'expected_updated_at', pg_temp.updated_at('00000000-0000-4000-8000-000000000101'),
      'name', 'Harbor Light',
      'name_en', 'Harbor Light',
      'tagline_en', 'Light on the water',
      'description_en', 'A fictional harbour-side room for local development.',
      'timezone', 'UTC',
      'slug', 'hijacked-harbor',
      'content_classification', 'nightlife_18_plus',
      'platform_quarantined_at', '2000-01-01T00:00:00Z',
      'contacts', jsonb_build_array(
        jsonb_build_object('type', 'email', 'value', 'harbor.public@example.com')
      )
    )
  )->>'ok')::boolean,
  'owner can save public profile fields'
);

SELECT is(
  (
    SELECT v.slug
    FROM public.venues v
    WHERE v.id = '00000000-0000-4000-8000-000000000101'
  ),
  (SELECT slug FROM harbor_profile_snap),
  'profile RPC ignores extra slug writes'
);

SELECT is(
  (
    SELECT v.timezone
    FROM public.venues v
    WHERE v.id = '00000000-0000-4000-8000-000000000101'
  ),
  (SELECT timezone FROM harbor_profile_snap),
  'profile RPC ignores extra timezone writes'
);

SELECT is(
  (
    SELECT v.platform_quarantined_at
    FROM public.venues v
    WHERE v.id = '00000000-0000-4000-8000-000000000101'
  ),
  (SELECT platform_quarantined_at FROM harbor_profile_snap),
  'profile RPC ignores extra quarantine writes'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM public.audit_log
    WHERE target_id = '00000000-0000-4000-8000-000000000101'
      AND action = 'manage_venue'
      AND (
        resulting_state::text ILIKE '%harbor.public@example.com%'
        OR resulting_state::text ILIKE '%1 Example Pier%'
        OR summary ILIKE '%harbour-side%'
      )
  ),
  'profile audit payloads omit addresses, contacts and descriptions'
);

SELECT pg_temp.as_postgres();

SELECT is(
  (
    SELECT content_classification
    FROM public.venues
    WHERE id = '00000000-0000-4000-8000-000000000101'
  ),
  'general',
  'profile RPC does not mutate classification'
);

UPDATE public.venues
SET
  platform_quarantined_at = pg_catalog.now(),
  platform_quarantine_reason = 'Venue profile publication regression',
  platform_quarantined_by = '00000000-0000-4000-8000-000000000001'
WHERE id = '00000000-0000-4000-8000-000000000202';

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000020');

SELECT is(
  public.set_venue_publication(
    '00000000-0000-4000-8000-000000000202',
    jsonb_build_object(
      'expected_updated_at', pg_temp.updated_at('00000000-0000-4000-8000-000000000202'),
      'publication_state', 'published'
    )
  )->>'code',
  'forbidden',
  'quarantine blocks tenant publication'
);

SELECT pg_temp.as_postgres();

UPDATE public.venues
SET
  platform_quarantined_at = NULL,
  platform_quarantine_reason = NULL,
  platform_quarantined_by = NULL
WHERE id = '00000000-0000-4000-8000-000000000202';

UPDATE public.venue_translations
SET tagline = NULL, description = NULL
WHERE venue_id = '00000000-0000-4000-8000-000000000202' AND locale = 'en';

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000020');

SELECT is(
  public.set_venue_publication(
    '00000000-0000-4000-8000-000000000202',
    jsonb_build_object(
      'expected_updated_at', pg_temp.updated_at('00000000-0000-4000-8000-000000000202'),
      'publication_state', 'published'
    )
  )->>'code',
  'not_ready',
  'publish requires English profile copy'
);

SELECT pg_temp.as_postgres();

UPDATE public.venue_translations
SET tagline = 'Not on the public site',
    description = 'Unpublished fictional draft venue.'
WHERE venue_id = '00000000-0000-4000-8000-000000000202' AND locale = 'en';

SELECT is(
  (
    SELECT count(*)::integer
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'save_venue_public_profile',
        'save_venue_opening_hours',
        'set_venue_publication',
        'save_venue_branding'
      )
      AND pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
  ),
  0,
  'anon cannot execute venue profile write RPCs'
);

SELECT ok(
  pg_catalog.has_function_privilege(
    'anon',
    'public.list_public_venue_profile(text, text)',
    'EXECUTE'
  ),
  'anon can execute the public profile reader'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'save_venue_public_profile'
  ),
  1,
  'save_venue_public_profile has no unsafe overload'
);

SELECT ok(
  (
    SELECT prosecdef AND proconfig::text LIKE '%search_path=%'
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'list_public_venue_profile'
  ),
  'list_public_venue_profile is SECURITY DEFINER with search_path'
);

SELECT ok(
  NOT pg_catalog.has_function_privilege(
    'authenticated',
    'app_private.replace_venue_hours(uuid, uuid, jsonb)',
    'EXECUTE'
  ),
  'private hours helper is not granted to authenticated'
);

SELECT throws_ok(
  $$ INSERT INTO public.venue_opening_hours (
       venue_id, day_of_week, sort_order, opens_local, closes_local, closes_next_day
     ) VALUES (
       '00000000-0000-4000-8000-000000000101', 1, 9, '10:00', '14:00', false
     ) $$,
  '23514',
  NULL,
  'sort_order CHECK rejects more than four intervals'
);

SELECT finish();

ROLLBACK;
