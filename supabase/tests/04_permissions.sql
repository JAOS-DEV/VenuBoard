-- Permission catalogue and matrix cells, plus helper behaviour.

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

SELECT is(
  (SELECT count(*)::integer FROM public.fixed_roles),
  7,
  'seven fixed roles'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM public.role_action_grants g
    JOIN public.fixed_roles r ON r.key = g.role_key
    WHERE r.axis IN ('business', 'venue')
      AND g.action_key IN (
        'manage_platform_entitlements',
        'manage_platform_tenants',
        'manage_platform_users',
        'moderate_content',
        'start_support_session',
        'grant_support_write_access'
      )
  ),
  'commercial roles cannot grant themselves platform actions'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000010');

SELECT ok(
  app_private.has_tenant_action_on_venue(
    'manage_venue',
    '00000000-0000-4000-8000-000000000101'
  ),
  'harbor owner has manage_venue on harbor-light'
);

SELECT ok(
  NOT app_private.has_tenant_action_on_venue(
    'manage_venue',
    '00000000-0000-4000-8000-000000000202'
  ),
  'harbor owner does not have manage_venue on draft-room'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000022');

SELECT ok(
  app_private.has_tenant_action_on_venue(
    'create_content',
    '00000000-0000-4000-8000-000000000201'
  ),
  'content editor has create_content on night-orchid'
);

SELECT ok(
  NOT app_private.has_tenant_action_on_venue(
    'manage_venue',
    '00000000-0000-4000-8000-000000000201'
  ),
  'content editor does not have manage_venue'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000023');

SELECT ok(
  app_private.has_tenant_action_on_venue(
    'manage_bookings',
    '00000000-0000-4000-8000-000000000201'
  ),
  'booking manager has manage_bookings'
);

SELECT ok(
  NOT app_private.has_tenant_action_on_venue(
    'create_content',
    '00000000-0000-4000-8000-000000000201'
  ),
  'booking manager does not have create_content'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000024');

SELECT ok(
  app_private.has_tenant_action_on_venue(
    'submit_content_for_approval',
    '00000000-0000-4000-8000-000000000201'
  ),
  'staff has submit_content_for_approval'
);

SELECT ok(
  NOT app_private.has_tenant_action_on_venue(
    'approve_content',
    '00000000-0000-4000-8000-000000000201'
  ),
  'staff does not have approve_content'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000001');

SELECT ok(
  app_private.has_platform_action('moderate_content'),
  'platform_admin has moderate_content'
);

SELECT ok(
  app_private.has_platform_action('manage_platform_entitlements'),
  'platform_admin has manage_platform_entitlements'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000002');

SELECT ok(
  NOT app_private.has_platform_action('moderate_content'),
  'platform_support does not have moderate_content'
);

SELECT ok(
  app_private.has_platform_action('start_support_session'),
  'platform_support can start a support session'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000026');

SELECT ok(
  NOT app_private.is_user_active(),
  'deactivated account is not active'
);

SELECT ok(
  NOT app_private.has_tenant_action_on_venue(
    'toggle_own_presence',
    '00000000-0000-4000-8000-000000000201'
  ),
  'deactivated user holds no effective venue actions'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.role_action_grants
    WHERE role_key = 'platform_admin' AND action_key = 'create_content'
  ),
  0,
  'platform_admin does not author content as an ordinary grant'
);

SELECT * FROM finish();

ROLLBACK;
