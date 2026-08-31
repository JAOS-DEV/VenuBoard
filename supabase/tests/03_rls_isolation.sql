-- RLS isolation: denied behaviour, not policy-definition inspection.
-- Identities are the seed UUIDs. Tests impersonate through JWT claims.
-- UPDATE denials that fail USING affect zero rows (no exception); INSERT
-- denials raise 42501. Both are asserted.

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

GRANT EXECUTE ON FUNCTION pg_temp.impersonate(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION pg_temp.impersonate_anon() TO anon, authenticated;

CREATE FUNCTION pg_temp.n_updated(p_sql text)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  n integer;
BEGIN
  EXECUTE p_sql;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

GRANT EXECUTE ON FUNCTION pg_temp.n_updated(text) TO anon, authenticated;

-- Public published venue read succeeds.
SELECT pg_temp.impersonate_anon();

SELECT isnt_empty(
  $$ SELECT id FROM public.venues WHERE slug = 'harbor-light' $$,
  'anon can read a published venue'
);

SELECT isnt_empty(
  $$ SELECT tagline FROM public.venue_translations
     WHERE venue_id = '00000000-0000-4000-8000-000000000101' AND locale = 'en' $$,
  'anon can read translations of a published venue'
);

SELECT is_empty(
  $$ SELECT id FROM public.venues WHERE slug = 'draft-room' $$,
  'anon cannot read an unpublished venue'
);

SELECT is_empty(
  $$ SELECT id FROM public.venue_translations
     WHERE venue_id = '00000000-0000-4000-8000-000000000202' $$,
  'anon cannot read translations of an unpublished parent'
);

SELECT is_empty(
  $$ SELECT id FROM public.venues WHERE slug = 'silent-room' $$,
  'anon cannot read a suspended venue even if publication_state is published'
);

SELECT throws_ok(
  $$ SELECT email FROM public.invitations $$,
  '42501',
  NULL,
  'anon cannot read invitations'
);

SELECT throws_ok(
  $$ SELECT id FROM public.audit_log $$,
  '42501',
  NULL,
  'anon cannot read audit_log'
);

-- Authorised tenant read succeeds; unpublished foreign venue is hidden.
SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000010');

SELECT isnt_empty(
  $$ SELECT id FROM public.venues WHERE slug = 'harbor-light' $$,
  'harbor owner can read their venue'
);

SELECT is_empty(
  $$ SELECT id FROM public.venues WHERE slug = 'draft-room' $$,
  'harbor owner cannot read an unpublished atlas venue'
);

SELECT isnt_empty(
  $$ SELECT id FROM public.venues WHERE slug = 'night-orchid' $$,
  'harbor owner can read night-orchid because they also hold staff membership there'
);

-- Atlas editor cannot write harbor translations (cross-venue write).
SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000022');

SELECT throws_ok(
  $$ INSERT INTO public.venue_translations (venue_id, locale, tagline)
     VALUES ('00000000-0000-4000-8000-000000000101', 'th', 'should fail') $$,
  '42501',
  NULL,
  'content editor cannot write another business venue translation'
);

SELECT is(
  pg_temp.n_updated($$ UPDATE public.venues SET name = 'Hijacked' WHERE slug = 'harbor-light' $$),
  0,
  'content editor update of another tenant venue changes zero rows'
);

-- Deactivated user access fails.
SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000026');

SELECT is_empty(
  $$ SELECT id FROM public.venues WHERE slug = 'draft-room' $$,
  'deactivated user cannot read unpublished tenant venues'
);

SELECT is_empty(
  $$ SELECT email FROM public.invitations $$,
  'deactivated user cannot read invitations'
);

SELECT is(
  pg_temp.n_updated($$ UPDATE public.venues SET name = 'Nope' WHERE slug = 'night-orchid' $$),
  0,
  'deactivated user cannot update a venue'
);

-- Venue user cannot alter entitlements.
SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000020');

SELECT throws_ok(
  $$ INSERT INTO public.venue_module_entitlements (
       venue_id, module_key, source_key, grant_type, starts_at, granted_by, reason
     ) VALUES (
       '00000000-0000-4000-8000-000000000201',
       'feed',
       'override',
       'allow',
       now(),
       '00000000-0000-4000-8000-000000000020',
       'self-grant'
     ) $$,
  '42501',
  NULL,
  'business owner cannot insert entitlements'
);

-- Platform support cannot moderate.
SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000002');

SELECT throws_ok(
  $$ SELECT app_private.apply_venue_moderation(
       '00000000-0000-4000-8000-000000000101',
       'quarantine',
       'support should not be able to do this',
       NULL
     ) $$,
  '42501',
  NULL,
  'platform_support cannot call apply_venue_moderation'
);

SELECT throws_ok(
  $$ INSERT INTO public.moderation_actions (
       platform_user_id, venue_id, target_table, target_id, action, reason
     ) VALUES (
       '00000000-0000-4000-8000-000000000002',
       '00000000-0000-4000-8000-000000000101',
       'venues',
       '00000000-0000-4000-8000-000000000101',
       'quarantine',
       'support moderation attempt'
     ) $$,
  '42501',
  NULL,
  'platform_support cannot insert moderation_actions'
);

-- Platform administrator has moderation authority, with a reason.
SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000001');

SELECT throws_ok(
  $$ SELECT app_private.apply_venue_moderation(
       '00000000-0000-4000-8000-000000000205',
       'quarantine',
       '   ',
       NULL
     ) $$,
  '23514',
  NULL,
  'moderation without a reason is rejected'
);

SELECT lives_ok(
  $$ SELECT app_private.apply_venue_moderation(
       '00000000-0000-4000-8000-000000000205',
       'quarantine',
       'Fictional acceptable-use breach for tests',
       NULL
     ) $$,
  'platform_admin can quarantine with a reason'
);

-- After quarantine the public path must not leak the venue.
SELECT pg_temp.impersonate_anon();

SELECT is_empty(
  $$ SELECT id FROM public.venues WHERE slug = 'trial-garden' $$,
  'anon cannot read a quarantined venue'
);

-- Venue cannot republish around quarantine.
SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000020');

SELECT throws_ok(
  $$ UPDATE public.venues
     SET publication_state = 'published',
         platform_quarantined_at = NULL,
         platform_quarantine_reason = NULL,
         platform_quarantined_by = NULL
     WHERE slug = 'trial-garden' $$,
  '42501',
  NULL,
  'venue owner cannot clear quarantine columns'
);

-- Normal venue users cannot directly write audit records.
SELECT throws_ok(
  $$ INSERT INTO public.audit_log (
       actor_user_id, action, scope_type, venue_id, outcome, environment
     ) VALUES (
       '00000000-0000-4000-8000-000000000020',
       'manage_venue',
       'venue',
       '00000000-0000-4000-8000-000000000201',
       'success',
       'local'
     ) $$,
  '42501',
  NULL,
  'venue user cannot insert audit_log rows'
);

-- Booking manager cannot update venue profile.
SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000023');

SELECT is(
  pg_temp.n_updated(
    $$ UPDATE public.venues SET name = 'Bookings renamed me' WHERE slug = 'night-orchid' $$
  ),
  0,
  'booking manager cannot update venue profile'
);

-- Staff cannot update venue translations.
SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000024');

SELECT is(
  pg_temp.n_updated(
    $$ UPDATE public.venue_translations SET tagline = 'staff edit'
       WHERE venue_id = '00000000-0000-4000-8000-000000000201' AND locale = 'en' $$
  ),
  0,
  'staff cannot update venue translations'
);

-- Authorised owner can update their own published venue.
SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000010');

SELECT lives_ok(
  $$ UPDATE public.venues SET city = 'Chonburi' WHERE slug = 'harbor-light' $$,
  'business owner can update their venue'
);

SELECT * FROM finish();

ROLLBACK;
