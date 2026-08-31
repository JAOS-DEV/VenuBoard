-- Structural integrity of the foundation schema.

BEGIN;

SELECT no_plan();

SELECT has_table('public', 'users', 'users exists');
SELECT has_table('public', 'platform_roles', 'platform_roles exists');
SELECT has_table('public', 'businesses', 'businesses exists');
SELECT has_table('public', 'venues', 'venues exists');
SELECT has_table('public', 'venue_translations', 'venue_translations exists');
SELECT has_table('public', 'business_memberships', 'business_memberships exists');
SELECT has_table('public', 'venue_memberships', 'venue_memberships exists');
SELECT has_table('public', 'invitations', 'invitations exists');
SELECT has_table('public', 'modules', 'modules exists');
SELECT has_table('public', 'plans', 'plans exists');
SELECT has_table('public', 'plan_modules', 'plan_modules exists');
SELECT has_table('public', 'entitlement_sources', 'entitlement_sources exists');
SELECT has_table('public', 'subscriptions', 'subscriptions exists');
SELECT has_table('public', 'venue_billing_records', 'venue_billing_records exists');
SELECT has_table('public', 'venue_module_entitlements', 'venue_module_entitlements exists');
SELECT has_table('public', 'venue_module_settings', 'venue_module_settings exists');
SELECT has_table('public', 'venue_module_setting_translations', 'setting translations exist');
SELECT has_table('public', 'venue_storage_usage', 'venue_storage_usage exists');
SELECT has_table('public', 'trial_extensions', 'trial_extensions exists');
SELECT has_table('public', 'support_sessions', 'support_sessions exists');
SELECT has_table('public', 'audit_log', 'audit_log exists');
SELECT has_table('public', 'moderation_actions', 'moderation_actions exists');
SELECT has_table('public', 'permission_actions', 'permission_actions exists');
SELECT has_table('public', 'role_action_grants', 'role_action_grants exists');
SELECT has_view('public', 'business_subscription_overview', 'overview view exists');

SELECT ok(
  (SELECT relrowsecurity AND relforcerowsecurity
   FROM pg_class c
   JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'venues'),
  'venues has RLS forced'
);

SELECT ok(
  (SELECT relrowsecurity AND relforcerowsecurity
   FROM pg_class c
   JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'venue_translations'),
  'venue_translations has RLS forced'
);

SELECT ok(
  (SELECT relrowsecurity AND relforcerowsecurity
   FROM pg_class c
   JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'audit_log'),
  'audit_log has RLS forced'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname IN ('public', 'app_private')
      AND t.typtype = 'e'
  ),
  0,
  'no PostgreSQL enum types in public or app_private'
);

SELECT throws_ok(
  $$ UPDATE public.venues SET publication_state = 'live' WHERE slug = 'harbor-light' $$,
  '23514',
  NULL,
  'invalid publication_state is rejected'
);

SELECT throws_ok(
  $$ UPDATE public.venues SET content_classification = 'family' WHERE slug = 'harbor-light' $$,
  '23514',
  NULL,
  'invalid content_classification is rejected'
);

SELECT throws_ok(
  $$ INSERT INTO public.venue_translations (venue_id, locale, tagline)
     VALUES ('00000000-0000-4000-8000-000000000101', 'fr', 'bonjour') $$,
  '23514',
  NULL,
  'invalid translation locale is rejected'
);

SELECT is(
  (SELECT count(*)::integer FROM public.permission_actions),
  33,
  'exactly 33 permission actions'
);

SELECT ok(
  (SELECT count(*) = 33 AND count(DISTINCT key) = 33 FROM public.permission_actions),
  'action keys are unique'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.permission_actions WHERE key = 'moderate_content'
  ),
  'catalogue includes moderate_content'
);

SELECT is(
  (
    SELECT grant_kind
    FROM public.role_action_grants
    WHERE role_key = 'platform_admin' AND action_key = 'moderate_content'
  ),
  'allow',
  'platform_admin holds moderate_content'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM public.role_action_grants
    WHERE role_key = 'platform_support' AND action_key = 'moderate_content'
  ),
  'platform_support does not receive moderate_content'
);

SELECT is(
  (SELECT count(*)::integer FROM public.modules),
  8,
  'eight MVP modules'
);

SELECT ok(
  EXISTS (SELECT 1 FROM public.modules WHERE key = 'core_profile' AND is_core),
  'core_profile is the core module'
);

SELECT is(
  (SELECT count(*)::integer FROM public.entitlement_sources),
  4,
  'four entitlement sources'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM (VALUES
      ('manage_business'),
      ('manage_venue'),
      ('manage_branding'),
      ('invite_users'),
      ('assign_roles'),
      ('view_private_staff_data'),
      ('manage_public_staff_profiles'),
      ('toggle_staff_presence'),
      ('create_content'),
      ('approve_content'),
      ('publish_content'),
      ('manage_events'),
      ('view_bookings'),
      ('manage_bookings'),
      ('view_analytics'),
      ('export_data'),
      ('manage_venue_module_visibility'),
      ('manage_platform_entitlements'),
      ('view_booking_customer_details'),
      ('manage_atmosphere'),
      ('manage_offers'),
      ('manage_own_public_profile'),
      ('toggle_own_presence'),
      ('manage_own_consent'),
      ('submit_content_for_approval'),
      ('manage_venue_domains'),
      ('manage_notification_preferences'),
      ('view_audit_log'),
      ('manage_platform_tenants'),
      ('start_support_session'),
      ('grant_support_write_access'),
      ('manage_platform_users'),
      ('moderate_content')
    ) AS expected(key)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.permission_actions a WHERE a.key = expected.key
    )
  ),
  'catalogue matches the 33 documented action keys'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.role_action_grants
    WHERE role_key = 'business_owner' AND grant_kind IN ('allow', 'conditional')
  ),
  27,
  'business_owner grant count matches the matrix (27 non-deny cells)'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'venues_quarantine_blocks_publication_check'
  ),
  'quarantine blocks publication'
);

SELECT * FROM finish();

ROLLBACK;
