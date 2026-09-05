-- C1–C19 foundation enforcement plus additional security checks.
-- Identities are seed UUIDs. Impersonation uses JWT claims.

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

GRANT EXECUTE ON FUNCTION pg_temp.impersonate(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION pg_temp.impersonate_anon() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION pg_temp.as_postgres() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION pg_temp.n_updated(text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Structural: RLS forced, search_path, execute grants
-- ---------------------------------------------------------------------------

SELECT is(
  (
    SELECT count(*)::integer
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND NOT (c.relrowsecurity AND c.relforcerowsecurity)
  ),
  0,
  'every public table has RLS enabled and forced'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname IN ('public', 'app_private')
      AND p.prosecdef
      AND NOT EXISTS (
        SELECT 1
        FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS cfg
        WHERE cfg IN ('search_path=', 'search_path=""')
      )
  ),
  'security-definer helpers fix search_path to empty'
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'app_private.apply_venue_moderation(uuid,text,text,text)',
    'EXECUTE'
  ),
  'anon cannot execute apply_venue_moderation'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) AS a
    WHERE n.nspname = 'app_private'
      AND p.proname = 'apply_venue_moderation'
      AND a.grantee = 0
      AND a.privilege_type = 'EXECUTE'
  ),
  'PUBLIC cannot execute apply_venue_moderation'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.proname NOT IN (
        'inspect_invitation',
        'accept_invitation',
        'evaluate_permission',
        'onboard_platform_venue',
        'venue_slug_is_available',
        'list_public_staff_presence',
        'create_staff_member_with_profile',
        'assign_staff_to_venue',
        'update_staff_public_profile',
        'set_staff_public_consent',
        'set_staff_presence',
        'bulk_mark_staff_not_present',
        'deactivate_staff_member',
        'restore_staff_member',
        'create_event',
        'update_event_draft',
        'submit_event_for_approval',
        'approve_event',
        'reject_event',
        'publish_event_now',
        'schedule_event_publication',
        'cancel_event',
        'archive_event',
        'restore_event_to_draft',
        'copy_event_to_venue',
        'update_events_module_settings',
        'list_public_venue_events',
        'set_venue_atmosphere',
        'clear_venue_atmosphere',
        'update_atmosphere_module_settings',
        'get_public_venue_atmosphere',
        'create_feed_post',
        'update_feed_post_draft',
        'submit_feed_post_for_approval',
        'approve_feed_post',
        'reject_feed_post',
        'publish_feed_post_now',
        'schedule_feed_post_publication',
        'unpublish_feed_post',
        'pin_feed_post',
        'unpin_feed_post',
        'archive_feed_post',
        'restore_feed_post_to_draft',
        'copy_feed_post_to_venue',
        'update_feed_module_settings',
        'list_public_venue_feed'
      )
  ),
  'no SECURITY DEFINER helpers are exposed in public except invitation and permission RPCs'
);

-- ---------------------------------------------------------------------------
-- Private users table
-- ---------------------------------------------------------------------------

SELECT pg_temp.impersonate_anon();

SELECT throws_ok(
  $$ SELECT email FROM public.users $$,
  '42501',
  NULL,
  'anon cannot read the private users table'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000022');

SELECT is_empty(
  $$ SELECT id FROM public.users WHERE id = '00000000-0000-4000-8000-000000000001' $$,
  'authenticated tenant user cannot read an unrelated private user record'
);

SELECT isnt_empty(
  $$ SELECT id FROM public.users WHERE id = '00000000-0000-4000-8000-000000000022' $$,
  'authenticated user can read their own users row'
);

-- ---------------------------------------------------------------------------
-- Catalogue writes and privilege escalation
-- ---------------------------------------------------------------------------

SELECT throws_ok(
  $$ INSERT INTO public.platform_roles (user_id, role)
     VALUES ('00000000-0000-4000-8000-000000000022', 'platform_admin') $$,
  '42501',
  NULL,
  'venue user cannot insert platform_roles'
);

SELECT throws_ok(
  $$ INSERT INTO public.role_action_grants (role_key, action_key, grant_kind)
     VALUES ('staff', 'manage_platform_users', 'allow') $$,
  '42501',
  NULL,
  'venue user cannot write role_action_grants'
);

SELECT throws_ok(
  $$ UPDATE public.modules SET name = 'Hijacked' WHERE key = 'feed' $$,
  '42501',
  NULL,
  'venue user cannot update modules'
);

SELECT throws_ok(
  $$ UPDATE public.plans SET name = 'Hijacked'
     WHERE id = '10000000-0000-4000-8000-000000000001' $$,
  '42501',
  NULL,
  'venue user cannot update plans'
);

SELECT throws_ok(
  $$ UPDATE public.entitlement_sources SET name = 'Hijacked' WHERE key = 'plan' $$,
  '42501',
  NULL,
  'venue user cannot update entitlement_sources'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000002');

SELECT throws_ok(
  $$ INSERT INTO public.platform_roles (user_id, role, granted_by)
     VALUES (
       '00000000-0000-4000-8000-000000000002',
       'platform_admin',
       '00000000-0000-4000-8000-000000000002'
     ) $$,
  '42501',
  NULL,
  'platform_support cannot grant itself platform_admin'
);

-- Users cannot reactivate themselves (policy + trigger).
SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000026');

SELECT is(
  pg_temp.n_updated(
    $$ UPDATE public.users
       SET account_status = 'active', deactivated_at = NULL
       WHERE id = '00000000-0000-4000-8000-000000000026' $$
  ),
  0,
  'deactivated user cannot reactivate themselves'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000022');

SELECT throws_ok(
  $$ UPDATE public.users
     SET account_status = 'deactivated'
     WHERE id = '00000000-0000-4000-8000-000000000022' $$,
  '42501',
  NULL,
  'active user cannot change their own account_status'
);

-- Audit and moderation are not writable by venue roles.
SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000020');

SELECT throws_ok(
  $$ UPDATE public.audit_log SET summary = 'tamper' WHERE actor_platform_role IS NULL $$,
  '42501',
  NULL,
  'venue owner cannot update audit_log'
);

SELECT throws_ok(
  $$ DELETE FROM public.audit_log WHERE actor_platform_role IS NULL $$,
  '42501',
  NULL,
  'venue owner cannot delete audit_log'
);

SELECT throws_ok(
  $$ UPDATE public.moderation_actions SET reason = 'tamper' $$,
  '42501',
  NULL,
  'venue owner cannot update moderation_actions'
);

SELECT throws_ok(
  $$ DELETE FROM public.moderation_actions $$,
  '42501',
  NULL,
  'venue owner cannot delete moderation_actions'
);

-- Overview view is security_invoker and cannot bypass RLS.
SELECT pg_temp.impersonate_anon();

SELECT throws_ok(
  $$ SELECT business_id FROM public.business_subscription_overview $$,
  '42501',
  NULL,
  'anon cannot read business_subscription_overview'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000002');

SELECT is_empty(
  $$ SELECT business_id FROM public.business_subscription_overview $$,
  'platform_support without a live session cannot read tenant subscriptions via the overview'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000022');

SELECT isnt_empty(
  $$ SELECT business_id FROM public.business_subscription_overview
     WHERE business_id = '00000000-0000-4000-8000-000000000200' $$,
  'atlas editor can read their tenant subscription overview rows'
);

SELECT is_empty(
  $$ SELECT business_id FROM public.business_subscription_overview
     WHERE business_id = '00000000-0000-4000-8000-000000000100' $$,
  'atlas editor cannot read harbor rows through the overview'
);

-- ---------------------------------------------------------------------------
-- C1: venue_manager invite_users default-deny until owner setting exists
-- ---------------------------------------------------------------------------

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000021');

SELECT ok(
  NOT app_private.has_tenant_action_on_venue(
    'invite_users',
    '00000000-0000-4000-8000-000000000201'
  ),
  'C1: venue_manager invite_users is not effective without the owner setting'
);

SELECT throws_ok(
  $$ INSERT INTO public.invitations (
       email, scope_type, venue_id, role, token_hash, invited_by, expires_at, state
     ) VALUES (
       'manager.invite@example.com',
       'venue',
       '00000000-0000-4000-8000-000000000201',
       'staff',
       'hash-c1-denied',
       '00000000-0000-4000-8000-000000000021',
       now() + interval '1 day',
       'pending'
     ) $$,
  '42501',
  NULL,
  'C1: venue_manager cannot insert invitations'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000020');

SELECT lives_ok(
  $$ INSERT INTO public.invitations (
       email, scope_type, venue_id, role, token_hash, invited_by, expires_at, state
     ) VALUES (
       'owner.invite@example.com',
       'venue',
       '00000000-0000-4000-8000-000000000201',
       'staff',
       'hash-c1-owner',
       '00000000-0000-4000-8000-000000000020',
       now() + interval '1 day',
       'pending'
     ) $$,
  'C1: business owner can still invite into a venue'
);

-- ---------------------------------------------------------------------------
-- C2: venue_manager assign_roles — own venues, not self, never business
-- ---------------------------------------------------------------------------

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000021');

SELECT ok(
  app_private.has_tenant_action_on_venue(
    'assign_roles',
    '00000000-0000-4000-8000-000000000202'
  ),
  'C2: venue_manager assign_roles is effective so membership WITH CHECK can run'
);

SELECT throws_ok(
  $$ INSERT INTO public.business_memberships (
       business_id, user_id, role, status
     ) VALUES (
       '00000000-0000-4000-8000-000000000200',
       '00000000-0000-4000-8000-000000000022',
       'business_owner',
       'active'
     ) $$,
  '42501',
  NULL,
  'C2: venue_manager cannot create business memberships'
);

SELECT throws_ok(
  $$ INSERT INTO public.venue_memberships (
       venue_id, user_id, role, status
     ) VALUES (
       '00000000-0000-4000-8000-000000000202',
       '00000000-0000-4000-8000-000000000021',
       'content_editor',
       'active'
     ) $$,
  '42501',
  NULL,
  'C2: venue_manager cannot assign a role to themselves'
);

SELECT throws_ok(
  $$ INSERT INTO public.venue_memberships (
       venue_id, user_id, role, status
     ) VALUES (
       '00000000-0000-4000-8000-000000000101',
       '00000000-0000-4000-8000-000000000022',
       'staff',
       'active'
     ) $$,
  '42501',
  NULL,
  'C2: venue_manager cannot assign roles on a venue they do not manage'
);

SELECT lives_ok(
  $$ INSERT INTO public.venue_memberships (
       venue_id, user_id, role, status
     ) VALUES (
       '00000000-0000-4000-8000-000000000202',
       '00000000-0000-4000-8000-000000000022',
       'staff',
       'active'
     ) $$,
  'C2: venue_manager can assign a lower venue role on a venue they manage'
);

-- ---------------------------------------------------------------------------
-- C3–C12, C14, C18: default-deny until product tables exist
-- ---------------------------------------------------------------------------

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000024');

SELECT ok(
  NOT app_private.has_tenant_action_on_venue(
    'toggle_staff_presence',
    '00000000-0000-4000-8000-000000000201'
  ),
  'C3: staff toggle_staff_presence grant helper stays false; own-only writes are in 08_staff_presence.sql'
);

-- Staff create_content is conditional (C4).
SELECT ok(
  NOT app_private.has_tenant_action_on_venue(
    'create_content',
    '00000000-0000-4000-8000-000000000201'
  ),
  'C4: staff create_content is conditional and default-denied until feed tables exist'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000022');

SELECT ok(
  NOT app_private.has_tenant_action_on_venue(
    'publish_content',
    '00000000-0000-4000-8000-000000000201'
  ),
  'C5: content_editor publish_content is default-denied until the approval setting exists'
);

SELECT ok(
  NOT app_private.has_tenant_action_on_venue(
    'manage_events',
    '00000000-0000-4000-8000-000000000201'
  ),
  'C5: content_editor manage_events is default-denied until events tables exist'
);

SELECT ok(
  NOT app_private.has_tenant_action_on_venue(
    'manage_offers',
    '00000000-0000-4000-8000-000000000201'
  ),
  'C5: content_editor manage_offers is default-denied until offers tables exist'
);

SELECT ok(
  NOT app_private.has_tenant_action_on_venue(
    'manage_atmosphere',
    '00000000-0000-4000-8000-000000000201'
  ),
  'C6: content_editor manage_atmosphere remains grant-helper deny; opt-in is row-level'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000021');

SELECT ok(
  NOT app_private.has_tenant_action_on_venue(
    'view_analytics',
    '00000000-0000-4000-8000-000000000201'
  ),
  'C7: venue_manager view_analytics is default-denied until analytics tables exist'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000023');

SELECT ok(
  NOT app_private.has_tenant_action_on_venue(
    'view_analytics',
    '00000000-0000-4000-8000-000000000201'
  ),
  'C8: booking_manager view_analytics is default-denied until booking analytics exist'
);

SELECT ok(
  NOT app_private.has_tenant_action_on_venue(
    'export_data',
    '00000000-0000-4000-8000-000000000201'
  ),
  'C9: booking_manager export_data is default-denied until an export path exists'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000021');

SELECT ok(
  NOT app_private.has_tenant_action_on_venue(
    'export_data',
    '00000000-0000-4000-8000-000000000201'
  ),
  'C9: venue_manager export_data is default-denied until an export path exists'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000001');

SELECT ok(
  NOT app_private.platform_may_write_tenant(
    '00000000-0000-4000-8000-000000000100',
    '00000000-0000-4000-8000-000000000101'
  ),
  'C10/C19: platform_admin has no live support write session on harbor-light'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000002');

SELECT ok(
  NOT app_private.platform_may_read_tenant(
    '00000000-0000-4000-8000-000000000100',
    '00000000-0000-4000-8000-000000000101'
  ),
  'C11: platform_support cannot read private tenant data without a live session'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000021');

SELECT ok(
  NOT app_private.has_tenant_action_on_venue(
    'manage_venue_domains',
    '00000000-0000-4000-8000-000000000201'
  ),
  'C12: venue_manager manage_venue_domains is default-denied until venue_domains exists'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000020');

SELECT ok(
  NOT app_private.has_tenant_action_on_venue(
    'toggle_own_presence',
    '00000000-0000-4000-8000-000000000201'
  ),
  'C14: toggle_own_presence is default-denied until public staff profiles exist'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('events', 'event_translations')
  ),
  'C18: events tables exist; cross-venue copy enforcement lives in events-specific tests'
);

-- ---------------------------------------------------------------------------
-- C13: tenants cannot see platform-internal audit rows
-- ---------------------------------------------------------------------------

SELECT pg_temp.as_postgres();

INSERT INTO public.audit_log (
  actor_user_id, actor_platform_role, action, scope_type,
  business_id, venue_id, summary, outcome, environment
) VALUES (
  '00000000-0000-4000-8000-000000000001',
  'platform_admin',
  'manage_platform_tenants',
  'platform',
  '00000000-0000-4000-8000-000000000200',
  '00000000-0000-4000-8000-000000000201',
  'Platform-internal fixture',
  'success',
  'local'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000020');

SELECT is_empty(
  $$ SELECT id FROM public.audit_log WHERE actor_platform_role IS NOT NULL $$,
  'C13: business owner cannot read platform-internal audit rows'
);

SELECT isnt_empty(
  $$ SELECT id FROM public.audit_log
     WHERE actor_platform_role IS NULL
       AND venue_id = '00000000-0000-4000-8000-000000000201' $$,
  'C13: business owner can read tenant-scoped audit rows for their venues'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000021');

SELECT is_empty(
  $$ SELECT id FROM public.audit_log WHERE actor_platform_role IS NOT NULL $$,
  'C13: venue_manager cannot read platform-internal audit rows'
);

-- ---------------------------------------------------------------------------
-- C15: pending/suspended accounts hold no grants
-- ---------------------------------------------------------------------------

SELECT pg_temp.as_postgres();

UPDATE public.users
SET account_status = 'pending'
WHERE id = '00000000-0000-4000-8000-000000000022';

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000022');

SELECT ok(
  NOT app_private.is_user_active(),
  'C15: pending account is not active'
);

SELECT ok(
  NOT app_private.has_tenant_action_on_venue(
    'create_content',
    '00000000-0000-4000-8000-000000000201'
  ),
  'C15: pending account holds no venue actions'
);

SELECT pg_temp.as_postgres();

UPDATE public.users
SET account_status = 'suspended'
WHERE id = '00000000-0000-4000-8000-000000000022';

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000022');

SELECT ok(
  NOT app_private.has_tenant_action_on_venue(
    'create_content',
    '00000000-0000-4000-8000-000000000201'
  ),
  'C15: suspended account holds no venue actions'
);

SELECT pg_temp.as_postgres();

UPDATE public.users
SET account_status = 'active'
WHERE id = '00000000-0000-4000-8000-000000000022';

-- ---------------------------------------------------------------------------
-- C16: restricted blocks writes, public stays; suspended blocks public
-- ---------------------------------------------------------------------------

SELECT pg_temp.impersonate_anon();

SELECT isnt_empty(
  $$ SELECT id FROM public.venues WHERE slug = 'restricted-room' $$,
  'C16: anon can still read a restricted published venue'
);

SELECT is_empty(
  $$ SELECT id FROM public.venues WHERE slug = 'silent-room' $$,
  'C16: anon cannot read a suspended venue'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000020');

SELECT is(
  pg_temp.n_updated(
    $$ UPDATE public.venues SET name = 'Restricted hijack' WHERE slug = 'restricted-room' $$
  ),
  0,
  'C16: tenant cannot write a restricted venue'
);

SELECT is(
  pg_temp.n_updated(
    $$ UPDATE public.venues SET name = 'Silent hijack' WHERE slug = 'silent-room' $$
  ),
  0,
  'C16: tenant cannot write a suspended venue'
);

-- ---------------------------------------------------------------------------
-- C17: visibility cannot create an entitlement
-- ---------------------------------------------------------------------------

SELECT throws_ok(
  $$ INSERT INTO public.venue_module_settings (venue_id, module_key, is_enabled)
     VALUES ('00000000-0000-4000-8000-000000000201', 'offers', true) $$,
  '23514',
  NULL,
  'C17: cannot enable a module that is not entitled (night-orchid offers deny)'
);

SELECT throws_ok(
  $$ INSERT INTO public.venue_module_entitlements (
       venue_id, module_key, source_key, grant_type, starts_at, granted_by, reason
     ) VALUES (
       '00000000-0000-4000-8000-000000000201',
       'offers',
       'override',
       'allow',
       now(),
       '00000000-0000-4000-8000-000000000020',
       'self-entitle'
     ) $$,
  '42501',
  NULL,
  'C17: tenant cannot insert entitlements'
);

-- ---------------------------------------------------------------------------
-- C19: platform tenant content writes need a support write session
-- ---------------------------------------------------------------------------

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000001');

SELECT throws_ok(
  $$ UPDATE public.venues SET name = 'Platform renamed harbor'
     WHERE slug = 'harbor-light' $$,
  '42501',
  NULL,
  'C19: platform_admin cannot edit venue profile fields without a write session'
);

SELECT throws_ok(
  $$ UPDATE public.businesses SET name = 'Platform renamed harbor biz'
     WHERE id = '00000000-0000-4000-8000-000000000100' $$,
  '42501',
  NULL,
  'C19: platform_admin cannot edit business profile fields without a write session'
);

SELECT throws_ok(
  $$ INSERT INTO public.invitations (
       email, scope_type, venue_id, role, token_hash, invited_by, expires_at, state
     ) VALUES (
       'platform.invite@example.com',
       'venue',
       '00000000-0000-4000-8000-000000000101',
       'staff',
       'hash-c19',
       '00000000-0000-4000-8000-000000000001',
       now() + interval '1 day',
       'pending'
     ) $$,
  '42501',
  NULL,
  'C19: platform_admin cannot invite into a tenant without a write session'
);

SELECT throws_ok(
  $$ INSERT INTO public.venue_memberships (
       venue_id, user_id, role, status
     ) VALUES (
       '00000000-0000-4000-8000-000000000101',
       '00000000-0000-4000-8000-000000000022',
       'staff',
       'active'
     ) $$,
  '42501',
  NULL,
  'C19: platform_admin cannot assign venue roles without a write session'
);

-- Platform records still allowed: operational status without touching profile.
SELECT lives_ok(
  $$ UPDATE public.venues
     SET classification_locked_by_platform = true
     WHERE slug = 'harbor-light' $$,
  'C19: platform_admin may lock classification without a support session'
);

SELECT pg_temp.as_postgres();

INSERT INTO public.support_sessions (
  operator_user_id, target_business_id, target_venue_id, reason, mode,
  write_granted_by, write_granted_at, write_expires_at, started_at, expires_at
) VALUES (
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000100',
  '00000000-0000-4000-8000-000000000101',
  'C19 test write session',
  'write',
  '00000000-0000-4000-8000-000000000001',
  now(),
  now() + interval '1 hour',
  now(),
  now() + interval '1 hour'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000001');

SELECT lives_ok(
  $$ UPDATE public.venues SET city = 'Support City' WHERE slug = 'harbor-light' $$,
  'C19: platform_admin can edit venue profile inside a live write session'
);

SELECT * FROM finish();

ROLLBACK;
