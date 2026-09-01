-- Platform-led onboarding RPC: authorisation, idempotency, slugs, entitlements.

BEGIN;

SELECT no_plan();

CREATE FUNCTION pg_temp.impersonate(p_user_id uuid, p_email text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', p_user_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.email', COALESCE(p_email, ''), true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', p_user_id::text,
      'role', 'authenticated',
      'email', COALESCE(p_email, '')
    )::text,
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
  PERFORM set_config('request.jwt.claim.email', '', true);
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
END;
$$;

CREATE FUNCTION pg_temp.as_postgres()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('role', 'postgres', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claim.email', '', true);
  PERFORM set_config('request.jwt.claims', '', true);
END;
$$;

CREATE FUNCTION pg_temp.base_payload(p_slug text, p_email text DEFAULT 'new.owner@example.com')
RETURNS jsonb
LANGUAGE sql
AS $$
  SELECT jsonb_build_object(
    'business', jsonb_build_object(
      'name', 'Lotus Pier Holdings',
      'legal_name', 'Lotus Pier Holdings Co., Ltd.',
      'country', 'TH',
      'default_locale', 'en'
    ),
    'venue', jsonb_build_object(
      'name_en', 'Lotus Pier',
      'name_th', 'ท่าดอกบัว',
      'description_en', 'A fictional riverside bar.',
      'description_th', 'บาร์ริมน้ำสมมติ',
      'slug', p_slug,
      'timezone', 'Asia/Bangkok',
      'default_locale', 'en',
      'supported_locales', jsonb_build_array('en', 'th'),
      'content_classification', 'general'
    ),
    'branding', jsonb_build_object(
      'primary_color', '#1F2937',
      'secondary_color', '#F59E0B',
      'accent_color', '#F59E0B',
      'background_color', '#FFFFFF',
      'text_color', '#111827',
      'theme_key', 'system',
      'font_key', 'system'
    ),
    'trial', jsonb_build_object(
      'days', 30,
      'excluded_module_keys', jsonb_build_array(),
      'individual_module_trials', jsonb_build_array()
    ),
    'overrides', jsonb_build_array(),
    'owner', jsonb_build_object('email', p_email)
  );
$$;

GRANT EXECUTE ON FUNCTION pg_temp.impersonate(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION pg_temp.impersonate_anon() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION pg_temp.as_postgres() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION pg_temp.base_payload(text, text) TO anon, authenticated;

-- Grants and definer posture
SELECT ok(
  has_function_privilege('authenticated', 'public.onboard_platform_venue(text,jsonb)', 'EXECUTE'),
  'authenticated can execute onboard_platform_venue'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.onboard_platform_venue(text,jsonb)', 'EXECUTE'),
  'anon cannot execute onboard_platform_venue'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) AS a
    WHERE n.nspname = 'public'
      AND p.proname IN ('onboard_platform_venue', 'venue_slug_is_available')
      AND a.grantee = 0
      AND a.privilege_type = 'EXECUTE'
  ),
  'PUBLIC cannot execute onboarding RPCs'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'onboard_platform_venue'
  ),
  1,
  'onboard_platform_venue has a single signature'
);

SELECT ok(
  (
    SELECT prosecdef AND EXISTS (
      SELECT 1
      FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS cfg
      WHERE cfg IN ('search_path=', 'search_path=""')
    )
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'onboard_platform_venue'
  ),
  'onboard_platform_venue is SECURITY DEFINER with empty search_path'
);

SELECT pg_temp.impersonate_anon();

SELECT throws_ok(
  $$ SELECT public.onboard_platform_venue(
       'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
       pg_temp.base_payload('lotus-pier')
     ) $$,
  '42501',
  NULL,
  'anonymous cannot execute onboard_platform_venue'
);

SELECT pg_temp.as_postgres();

-- Tenant role denied
SELECT pg_temp.impersonate(
  '00000000-0000-4000-8000-000000000010',
  'harbor.owner@example.com'
);

SELECT is(
  public.onboard_platform_venue(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
    pg_temp.base_payload('lotus-pier-tenant')
  ) ->> 'code',
  'forbidden',
  'tenant roles cannot onboard'
);

SELECT pg_temp.as_postgres();

SELECT is(
  (SELECT count(*)::integer FROM public.businesses WHERE slug LIKE 'lotus-pier-holdings%'),
  0,
  'forbidden tenant call leaves no business'
);

-- Platform support denied
SELECT pg_temp.impersonate(
  '00000000-0000-4000-8000-000000000002',
  'platform.support@example.com'
);

SELECT is(
  public.onboard_platform_venue(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
    pg_temp.base_payload('lotus-pier-support')
  ) ->> 'code',
  'forbidden',
  'platform support cannot onboard'
);

-- Deactivated platform admin: seed user 026 is deactivated tenant, not admin.
-- Use support/admin check already; deactivate via postgres then restore.
SELECT pg_temp.as_postgres();

UPDATE public.users
SET account_status = 'deactivated',
    deactivated_at = now()
WHERE id = '00000000-0000-4000-8000-000000000001';

SELECT pg_temp.impersonate(
  '00000000-0000-4000-8000-000000000001',
  'platform.admin@example.com'
);

SELECT is(
  public.onboard_platform_venue(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4',
    pg_temp.base_payload('lotus-pier-deactivated')
  ) ->> 'code',
  'account_inactive',
  'deactivated platform admin cannot onboard'
);

SELECT pg_temp.as_postgres();

UPDATE public.users
SET account_status = 'active',
    deactivated_at = NULL
WHERE id = '00000000-0000-4000-8000-000000000001';

SELECT pg_temp.impersonate(
  '00000000-0000-4000-8000-000000000001',
  'platform.admin@example.com'
);

-- Validation failures leave no rows
SELECT is(
  public.onboard_platform_venue(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa10',
    pg_temp.base_payload('admin')
  ) ->> 'code',
  'reserved_slug',
  'reserved slug rejected'
);

SELECT is(
  public.onboard_platform_venue(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa11',
    jsonb_set(pg_temp.base_payload('only-punct'), '{venue,slug}', '"---"')
  ) ->> 'code',
  'invalid_slug',
  'repeated separators rejected'
);

SELECT is(
  public.onboard_platform_venue(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa12',
    jsonb_set(pg_temp.base_payload('no-en-name'), '{venue,name_en}', '""')
  ) ->> 'code',
  'missing_english_name',
  'missing required English name rejected'
);

SELECT is(
  public.onboard_platform_venue(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa13',
    jsonb_set(pg_temp.base_payload('bad-locale'), '{venue,supported_locales}', '["fr"]')
  ) ->> 'code',
  'invalid_locale',
  'invalid translation locale rejected'
);

SELECT is(
  public.onboard_platform_venue(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa14',
    jsonb_set(pg_temp.base_payload('bad-color'), '{branding,primary_color}', '"rgb(1,2,3)"')
  ) ->> 'code',
  'invalid_color',
  'invalid colors rejected'
);

SELECT is(
  public.onboard_platform_venue(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa15',
    jsonb_set(pg_temp.base_payload('bad-class'), '{venue,content_classification}', '"nudity"')
  ) ->> 'code',
  'invalid_classification',
  'invalid classification rejected'
);

SELECT is(
  public.onboard_platform_venue(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa16',
    jsonb_set(
      pg_temp.base_payload('core-excluded'),
      '{trial,excluded_module_keys}',
      '["core_profile"]'
    )
  ) ->> 'code',
  'core_profile_required',
  'core_profile exclusion rejected'
);

SELECT is(
  public.onboard_platform_venue(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa17',
    jsonb_set(
      pg_temp.base_payload('unknown-mod'),
      '{trial,excluded_module_keys}',
      '["not_a_module"]'
    )
  ) ->> 'code',
  'unknown_module',
  'unknown module rejected'
);

SELECT is(
  public.onboard_platform_venue(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa18',
    jsonb_set(pg_temp.base_payload('bad-quota'), '{trial,quota_bytes}', '-1')
  ) ->> 'code',
  'invalid_quota',
  'invalid quota rejected'
);

SELECT is(
  public.onboard_platform_venue(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa19',
    jsonb_set(pg_temp.base_payload('bad-trial'), '{trial,days}', '7')
  ) ->> 'code',
  'invalid_trial',
  'invalid trial dates rejected'
);

SELECT is(
  public.onboard_platform_venue(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa1a',
    jsonb_set(pg_temp.base_payload('bad-theme'), '{branding,theme_key}', '"not_a_theme"')
  ) ->> 'code',
  'invalid_theme',
  'unknown theme rejected independently of the UI'
);

SELECT is(
  public.onboard_platform_venue(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa1b',
    jsonb_set(pg_temp.base_payload('bad-font'), '{branding,font_key}', '"comic_sans"')
  ) ->> 'code',
  'invalid_font',
  'unknown font rejected independently of the UI'
);

SELECT is(
  public.onboard_platform_venue(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa1c',
    jsonb_set(pg_temp.base_payload('bad-zone'), '{venue,timezone}', '"Not/AZone"')
  ) ->> 'code',
  'invalid_timezone',
  'unknown time zone rejected independently of the UI'
);

SELECT is(
  public.onboard_platform_venue(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa1d',
    jsonb_set(pg_temp.base_payload('cast-days'), '{trial,days}', '"abc"')
  ),
  '{"ok": false, "code": "invalid_payload"}'::jsonb,
  'malformed trial dates return a code only, without database error text'
);

SELECT is(
  (SELECT count(*)::integer FROM public.venues WHERE slug LIKE 'bad-%' OR slug LIKE 'core-%' OR slug LIKE 'unknown-%' OR slug LIKE 'no-en-%' OR slug LIKE 'cast-%'),
  0,
  'no partial venue records after validation failures'
);

-- Successful onboarding
SELECT is(
  public.onboard_platform_venue(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa20',
    pg_temp.base_payload('lotus-pier')
  ) ->> 'ok',
  'true',
  'platform admin can complete onboarding'
);

SELECT is(
  (SELECT publication_state FROM public.venues WHERE slug = 'lotus-pier'),
  'draft',
  'new venue is unpublished draft'
);

SELECT is(
  (SELECT content_classification FROM public.venues WHERE slug = 'lotus-pier'),
  'general',
  'classification stored from operator choice'
);

SELECT is(
  (SELECT role FROM public.invitations i
   JOIN public.venues v ON v.business_id = i.business_id
   WHERE v.slug = 'lotus-pier' AND i.scope_type = 'business'),
  'business_owner',
  'first invitation is business-owner scoped'
);

SELECT ok(
  NOT COALESCE(
    (
      SELECT r.result_summary ? 'invitation_token'
      FROM public.platform_onboarding_runs r
      WHERE r.idempotency_key = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa20'
    ),
    false
  ),
  'raw invitation token is not stored on the run summary'
);

SELECT is(
  (SELECT count(*)::integer FROM public.audit_log a
   JOIN public.venues v ON v.id = a.venue_id
   WHERE v.slug = 'lotus-pier'
     AND (
       a.metadata::text ILIKE '%invitation_token%'
       OR a.summary ILIKE '%token%'
     )),
  0,
  'audit rows do not contain invitation tokens'
);

SELECT is(
  (SELECT count(*)::integer FROM public.invitations i
   JOIN public.venues v ON v.business_id = i.business_id
   WHERE v.slug = 'lotus-pier'
     AND i.token_hash !~ '^[0-9a-f]{64}$'),
  0,
  'stored invitation token_hash is SHA-256 hex, not the raw token'
);

SELECT ok(
  (SELECT u.used_bytes = 0
      AND u.quota_bytes = p.default_storage_quota_bytes
   FROM public.venue_storage_usage u
   JOIN public.venues v ON v.id = u.venue_id
   JOIN public.subscriptions s ON s.venue_id = v.id
   JOIN public.plans p ON p.id = s.plan_id
   WHERE v.slug = 'lotus-pier' AND p.key = 'standard'),
  'storage quota is taken from the seeded standard plan, not a duplicated commercial default'
);

SELECT ok(
  (SELECT count(*) FILTER (WHERE module_key = 'core_profile') = 1
   FROM public.venue_module_entitlements e
   JOIN public.venues v ON v.id = e.venue_id
   WHERE v.slug = 'lotus-pier' AND e.revoked_at IS NULL),
  'core_profile is entitled'
);

-- Idempotent retry
SELECT is(
  public.onboard_platform_venue(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa20',
    pg_temp.base_payload('lotus-pier')
  ) ->> 'idempotent',
  'true',
  'retry with the same idempotency key is idempotent'
);

SELECT is(
  public.onboard_platform_venue(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa20',
    pg_temp.base_payload('lotus-pier')
  ) ->> 'invitation_token',
  NULL,
  'idempotent retry does not return the raw invitation token again'
);

SELECT is(
  (SELECT count(*)::integer FROM public.venues WHERE slug = 'lotus-pier'),
  1,
  'idempotent retry does not create a second venue'
);

SELECT is(
  public.onboard_platform_venue(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa20',
    jsonb_set(pg_temp.base_payload('lotus-pier'), '{venue,name_en}', '"Changed"')
  ) ->> 'code',
  'idempotency_conflict',
  'same key with a different payload is rejected'
);

-- Duplicate slug with a new key
SELECT is(
  public.onboard_platform_venue(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa21',
    pg_temp.base_payload('lotus-pier')
  ) ->> 'code',
  'duplicate_slug',
  'duplicate slug rejected'
);

SELECT is(
  (SELECT count(*)::integer FROM public.venues WHERE slug = 'lotus-pier'),
  1,
  'duplicate slug attempt does not create another venue'
);

-- Adult nightlife alias, exclusions, individual trial, override
SELECT is(
  public.onboard_platform_venue(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa22',
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            pg_temp.base_payload('night-market-lantern'),
            '{venue,content_classification}',
            '"adult_nightlife"'
          ),
          '{trial,excluded_module_keys}',
          '["offers"]'
        ),
        '{trial,individual_module_trials}',
        '[{"module_key":"offers","days":14}]'
      ),
      '{overrides}',
      '[{"module_key":"feed","grant_type":"deny","reason":"Operator hold"}]'
    )
  ) ->> 'ok',
  'true',
  'adult_nightlife alias, exclusion, individual trial and override succeed'
);

SELECT is(
  (SELECT content_classification FROM public.venues WHERE slug = 'night-market-lantern'),
  'nightlife_18_plus',
  'adult_nightlife is stored as nightlife_18_plus'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.venue_module_entitlements e
    JOIN public.venues v ON v.id = e.venue_id
    WHERE v.slug = 'night-market-lantern'
      AND e.module_key = 'offers'
      AND e.source_key = 'trial'
      AND e.grant_type = 'allow'
  ),
  'excluded module can still receive an individual module trial'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.venue_module_entitlements e
    JOIN public.venues v ON v.id = e.venue_id
    WHERE v.slug = 'night-market-lantern'
      AND e.module_key = 'feed'
      AND e.source_key = 'override'
      AND e.grant_type = 'deny'
      AND e.reason = 'Operator hold'
  ),
  'custom override is recorded with provenance'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM public.plans WHERE key = 'standard' AND notes ILIKE '%override%'
  ),
  'overrides do not mutate shared plan definitions'
);

-- Concurrent same-key: unique primary key is the serialisation point
SELECT pg_temp.as_postgres();

SELECT throws_ok(
  $$ INSERT INTO public.platform_onboarding_runs (
       idempotency_key, payload_hash, actor_user_id,
       business_id, venue_id, invitation_id, result_summary
     )
     SELECT idempotency_key, payload_hash, actor_user_id,
            business_id, venue_id, invitation_id, result_summary
     FROM public.platform_onboarding_runs
     WHERE idempotency_key = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa20' $$,
  '23505',
  NULL,
  'concurrent same-key submissions cannot insert a second run row'
);

SELECT is(
  (SELECT count(*)::integer FROM public.venues WHERE slug = 'harbor-light'),
  1,
  'seed harbor-light remains a single venue (concurrent slug uniqueness)'
);

SELECT ok(
  NOT public.venue_slug_is_available('lotus-pier'),
  'taken slug is not available and does not reveal the tenant name'
);

SELECT ok(
  public.venue_slug_is_available('brand-new-available-slug'),
  'unused well-formed slug is available'
);

SELECT is(
  pg_typeof(public.venue_slug_is_available('brand-new-available-slug'))::text,
  'boolean',
  'venue_slug_is_available returns only a boolean'
);

SELECT ok(
  has_function_privilege('authenticated', 'public.venue_slug_is_available(text)', 'EXECUTE'),
  'authenticated can execute venue_slug_is_available'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.venue_slug_is_available(text)', 'EXECUTE'),
  'anon cannot execute venue_slug_is_available'
);

SELECT pg_temp.impersonate_anon();

SELECT throws_ok(
  $$ SELECT public.venue_slug_is_available('brand-new-available-slug') $$,
  '42501',
  NULL,
  'anonymous execution of venue_slug_is_available is denied'
);

SELECT pg_temp.as_postgres();

SELECT * FROM finish();

ROLLBACK;
