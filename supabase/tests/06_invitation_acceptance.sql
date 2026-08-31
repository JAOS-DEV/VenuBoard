-- Invitation inspect/accept RPCs, permission evaluation, and execution grants.

BEGIN;

SELECT no_plan();

CREATE FUNCTION pg_temp.impersonate(p_user_id uuid, p_email text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_email text;
BEGIN
  SELECT COALESCE(p_email, u.email) INTO v_email
  FROM public.users u
  WHERE u.id = p_user_id;

  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', p_user_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.email', COALESCE(v_email, ''), true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', p_user_id::text,
      'role', 'authenticated',
      'email', COALESCE(v_email, '')
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

CREATE FUNCTION pg_temp.seed_invitee(
  p_id uuid,
  p_email text,
  p_status text DEFAULT 'pending'
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change,
    email_change_token_new, recovery_token, is_sso_user, is_anonymous
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    p_id,
    'authenticated',
    'authenticated',
    p_email,
    extensions.crypt(extensions.gen_random_uuid()::text, extensions.gen_salt('bf')),
    timestamptz '2026-08-01 00:00:00+00',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    timestamptz '2026-08-01 00:00:00+00',
    timestamptz '2026-08-01 00:00:00+00',
    p_id::text,
    '',
    '',
    p_id::text,
    false,
    false
  )
  ON CONFLICT (id) DO NOTHING;

  UPDATE public.users
  SET email = p_email,
      account_status = p_status,
      deactivated_at = CASE WHEN p_status = 'deactivated'
        THEN timestamptz '2026-08-01 00:00:00+00'
        ELSE NULL
      END
  WHERE id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION pg_temp.impersonate(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION pg_temp.impersonate_anon() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION pg_temp.as_postgres() TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Execution grants
-- ---------------------------------------------------------------------------

SELECT ok(
  has_function_privilege('anon', 'public.inspect_invitation(text)', 'EXECUTE'),
  'anon can inspect an invitation token'
);

SELECT ok(
  has_function_privilege('authenticated', 'public.inspect_invitation(text)', 'EXECUTE'),
  'authenticated can inspect an invitation token'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.accept_invitation(text)', 'EXECUTE'),
  'anon cannot accept invitations'
);

SELECT ok(
  has_function_privilege('authenticated', 'public.accept_invitation(text)', 'EXECUTE'),
  'authenticated can execute accept_invitation'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.evaluate_permission(text,text,uuid,uuid,uuid)', 'EXECUTE'),
  'anon cannot execute evaluate_permission'
);

SELECT ok(
  has_function_privilege('authenticated', 'public.evaluate_permission(text,text,uuid,uuid,uuid)', 'EXECUTE'),
  'authenticated can execute evaluate_permission'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) AS a
    WHERE n.nspname = 'public'
      AND p.proname IN ('accept_invitation', 'evaluate_permission', 'inspect_invitation')
      AND a.grantee = 0
      AND a.privilege_type = 'EXECUTE'
  ),
  'PUBLIC cannot execute invitation or permission RPCs'
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'app_private.invitation_token_hash(text)',
    'EXECUTE'
  ),
  'authenticated cannot execute the private token hasher'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'inspect_invitation'
  ),
  1,
  'inspect_invitation has a single signature'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'accept_invitation'
  ),
  1,
  'accept_invitation has a single signature'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'evaluate_permission'
  ),
  1,
  'evaluate_permission has a single signature'
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
    WHERE n.nspname = 'public' AND p.proname = 'inspect_invitation'
  ),
  'inspect_invitation is SECURITY DEFINER with empty search_path'
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
    WHERE n.nspname = 'public' AND p.proname = 'accept_invitation'
  ),
  'accept_invitation is SECURITY DEFINER with empty search_path'
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
    WHERE n.nspname = 'public' AND p.proname = 'evaluate_permission'
  ),
  'evaluate_permission is SECURITY DEFINER with empty search_path'
);

-- ---------------------------------------------------------------------------
-- Inspect
-- ---------------------------------------------------------------------------

SELECT pg_temp.impersonate_anon();

SELECT is(
  public.inspect_invitation('not-a-real-token'),
  '{"status":"invalid"}'::jsonb,
  'unknown token inspects as invalid with no extra fields'
);

SELECT is(
  public.inspect_invitation('not a real token!!'),
  '{"status":"invalid"}'::jsonb,
  'tokens outside the allowed charset inspect as invalid'
);

SELECT is(
  public.inspect_invitation(NULL) ->> 'status',
  'invalid',
  'null token inspects as invalid'
);

SELECT is(
  public.inspect_invitation('local-invite-atlas-editor-v1') ->> 'status',
  'pending',
  'seed invitation inspects as pending'
);

SELECT is(
  public.inspect_invitation('local-invite-atlas-editor-v1') ->> 'email',
  'new.editor@example.com',
  'token holder may see the invitation email'
);

SELECT is(
  public.inspect_invitation('local-invite-atlas-editor-v1') ->> 'role',
  'content_editor',
  'pending inspect returns the stored role'
);

SELECT is(
  public.inspect_invitation('local-invite-atlas-editor-v1') -> 'venue_id',
  NULL,
  'pending inspect does not include tenant UUIDs'
);

SELECT is(
  public.inspect_invitation('local-invite-atlas-editor-v1') -> 'business_id',
  NULL,
  'pending inspect does not include business UUIDs'
);

SELECT is(
  public.inspect_invitation('local-invite-atlas-editor-v1') ->> 'venue_name',
  'Night Orchid',
  'pending inspect returns the venue display name'
);

-- ---------------------------------------------------------------------------
-- Valid acceptance (C15 pending → active)
-- ---------------------------------------------------------------------------

SELECT pg_temp.as_postgres();

SELECT pg_temp.seed_invitee(
  '00000000-0000-4000-8000-0000000000a1',
  'new.editor@example.com',
  'pending'
);

SELECT pg_temp.impersonate(
  '00000000-0000-4000-8000-0000000000a1',
  'new.editor@example.com'
);

SELECT is(
  public.accept_invitation('local-invite-atlas-editor-v1') ->> 'ok',
  'true',
  'matching pending user can accept a valid invitation'
);

SELECT is(
  (SELECT account_status FROM public.users
   WHERE id = '00000000-0000-4000-8000-0000000000a1'),
  'active',
  'C15: accepting moves pending to active'
);

SELECT is(
  (SELECT role FROM public.venue_memberships
   WHERE user_id = '00000000-0000-4000-8000-0000000000a1'
     AND venue_id = '00000000-0000-4000-8000-000000000201'
     AND deactivated_at IS NULL),
  'content_editor',
  'membership is created in the invitation venue with the stored role'
);

SELECT is(
  (SELECT count(*)::integer FROM public.venue_memberships
   WHERE user_id = '00000000-0000-4000-8000-0000000000a1'),
  1,
  'acceptance does not create memberships in other venues'
);

SELECT is(
  (SELECT count(*)::integer FROM public.business_memberships
   WHERE user_id = '00000000-0000-4000-8000-0000000000a1'),
  0,
  'venue invitation does not create a business membership'
);

SELECT is(
  (SELECT count(*)::integer FROM public.platform_roles
   WHERE user_id = '00000000-0000-4000-8000-0000000000a1'),
  0,
  'invitation acceptance cannot create platform roles'
);

SELECT is(
  public.accept_invitation('local-invite-atlas-editor-v1') ->> 'idempotent',
  'true',
  'repeat acceptance by the same member is idempotent'
);

SELECT is(
  (SELECT count(*)::integer FROM public.venue_memberships
   WHERE user_id = '00000000-0000-4000-8000-0000000000a1'
     AND venue_id = '00000000-0000-4000-8000-000000000201'),
  1,
  'idempotent retry does not duplicate membership'
);

-- ---------------------------------------------------------------------------
-- Wrong authenticated email
-- ---------------------------------------------------------------------------

SELECT pg_temp.as_postgres();

INSERT INTO public.invitations (
  id, email, scope_type, venue_id, role, token_hash, invited_by, expires_at, state
) VALUES (
  '00000000-0000-4000-8000-0000000007a2',
  'wrong.email.target@example.com',
  'venue',
  '00000000-0000-4000-8000-000000000201',
  'staff',
  app_private.invitation_token_hash('invite-wrong-email-v1'),
  '00000000-0000-4000-8000-000000000020',
  now() + interval '7 days',
  'pending'
);

SELECT pg_temp.impersonate(
  '00000000-0000-4000-8000-000000000010',
  'harbor.owner@example.com'
);

SELECT is(
  public.accept_invitation('invite-wrong-email-v1') ->> 'code',
  'email_mismatch',
  'authenticated email must match the invitation email'
);

SELECT pg_temp.as_postgres();

SELECT is(
  (SELECT state FROM public.invitations
   WHERE id = '00000000-0000-4000-8000-0000000007a2'),
  'pending',
  'mismatched email leaves the invitation pending'
);

-- ---------------------------------------------------------------------------
-- Expired, revoked, already-accepted
-- ---------------------------------------------------------------------------

SELECT pg_temp.as_postgres();

SELECT pg_temp.seed_invitee(
  '00000000-0000-4000-8000-0000000000a3',
  'expiree@example.com',
  'pending'
);

INSERT INTO public.invitations (
  id, email, scope_type, venue_id, role, token_hash, invited_by, expires_at, state
) VALUES
  (
    '00000000-0000-4000-8000-0000000007a3',
    'expiree@example.com',
    'venue',
    '00000000-0000-4000-8000-000000000201',
    'staff',
    app_private.invitation_token_hash('invite-expired-v1'),
    '00000000-0000-4000-8000-000000000020',
    now() - interval '1 day',
    'pending'
  ),
  (
    '00000000-0000-4000-8000-0000000007a4',
    'expiree@example.com',
    'venue',
    '00000000-0000-4000-8000-000000000201',
    'staff',
    app_private.invitation_token_hash('invite-revoked-v1'),
    '00000000-0000-4000-8000-000000000020',
    now() + interval '7 days',
    'revoked'
  );

UPDATE public.invitations
SET revoked_at = now()
WHERE id = '00000000-0000-4000-8000-0000000007a4';

SELECT pg_temp.impersonate(
  '00000000-0000-4000-8000-0000000000a3',
  'expiree@example.com'
);

SELECT is(
  public.inspect_invitation('invite-expired-v1'),
  '{"status":"expired"}'::jsonb,
  'expired invitation inspects as expired with no extra fields'
);

SELECT is(
  public.accept_invitation('invite-expired-v1') ->> 'code',
  'invitation_unavailable',
  'expired invitation cannot be accepted'
);

SELECT is(
  public.inspect_invitation('invite-revoked-v1'),
  '{"status":"revoked"}'::jsonb,
  'revoked invitation inspects as revoked with no extra fields'
);

SELECT is(
  public.accept_invitation('invite-revoked-v1') ->> 'code',
  'invitation_unavailable',
  'revoked invitation cannot be accepted'
);

SELECT is(
  public.inspect_invitation('local-invite-atlas-editor-v1'),
  '{"status":"accepted"}'::jsonb,
  'already-accepted invitation inspects as accepted with no extra fields'
);

SELECT is(
  public.accept_invitation('local-invite-atlas-editor-v1') ->> 'code',
  'email_mismatch',
  'already-accepted invitation is not reusable by a different email'
);

-- ---------------------------------------------------------------------------
-- Cross-tenant: stored venue wins; invitee cannot retarget
-- ---------------------------------------------------------------------------

SELECT pg_temp.as_postgres();

SELECT pg_temp.seed_invitee(
  '00000000-0000-4000-8000-0000000000a4',
  'cross.tenant@example.com',
  'pending'
);

INSERT INTO public.invitations (
  id, email, scope_type, venue_id, role, token_hash, invited_by, expires_at, state
) VALUES (
  '00000000-0000-4000-8000-0000000007a5',
  'cross.tenant@example.com',
  'venue',
  '00000000-0000-4000-8000-000000000201',
  'staff',
  app_private.invitation_token_hash('invite-cross-tenant-v1'),
  '00000000-0000-4000-8000-000000000020',
  now() + interval '7 days',
  'pending'
);

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

SELECT pg_temp.impersonate(
  '00000000-0000-4000-8000-000000000010',
  'harbor.owner@example.com'
);

SELECT is(
  pg_temp.n_updated(
    $$ UPDATE public.invitations
       SET venue_id = '00000000-0000-4000-8000-000000000101'
       WHERE id = '00000000-0000-4000-8000-0000000007a5' $$
  ),
  0,
  'cross-tenant caller cannot retarget an invitation'
);

SELECT pg_temp.impersonate(
  '00000000-0000-4000-8000-0000000000a4',
  'cross.tenant@example.com'
);

SELECT is(
  public.accept_invitation('invite-cross-tenant-v1') ->> 'venue_id',
  '00000000-0000-4000-8000-000000000201',
  'acceptance uses the stored venue id'
);

SELECT is(
  (SELECT count(*)::integer FROM public.venue_memberships
   WHERE user_id = '00000000-0000-4000-8000-0000000000a4'
     AND venue_id = '00000000-0000-4000-8000-000000000101'),
  0,
  'acceptance does not create a harbor membership'
);

-- ---------------------------------------------------------------------------
-- Invalid role / platform escalation
-- ---------------------------------------------------------------------------

SELECT pg_temp.as_postgres();

SELECT throws_ok(
  $$ INSERT INTO public.invitations (
       email, scope_type, venue_id, role, token_hash, invited_by, expires_at
     ) VALUES (
       'role.fail@example.com',
       'venue',
       '00000000-0000-4000-8000-000000000201',
       'platform_admin',
       'hash-platform-role-forbidden',
       '00000000-0000-4000-8000-000000000020',
       now() + interval '7 days'
     ) $$,
  '23514',
  NULL,
  'invitations cannot assign platform roles'
);

SELECT throws_ok(
  $$ INSERT INTO public.invitations (
       email, scope_type, venue_id, role, token_hash, invited_by, expires_at
     ) VALUES (
       'role.fail@example.com',
       'venue',
       '00000000-0000-4000-8000-000000000201',
       'business_owner',
       'hash-business-owner-on-venue',
       '00000000-0000-4000-8000-000000000020',
       now() + interval '7 days'
     ) $$,
  '23514',
  NULL,
  'venue invitations cannot assign business_owner'
);

-- C2: existing active membership at a different role is not escalated.
SELECT pg_temp.seed_invitee(
  '00000000-0000-4000-8000-0000000000a5',
  'already.staff@example.com',
  'active'
);

INSERT INTO public.venue_memberships (
  venue_id, user_id, role, status, invited_by, accepted_at
) VALUES (
  '00000000-0000-4000-8000-000000000201',
  '00000000-0000-4000-8000-0000000000a5',
  'staff',
  'active',
  '00000000-0000-4000-8000-000000000020',
  now()
);

INSERT INTO public.invitations (
  id, email, scope_type, venue_id, role, token_hash, invited_by, expires_at, state
) VALUES (
  '00000000-0000-4000-8000-0000000007a6',
  'already.staff@example.com',
  'venue',
  '00000000-0000-4000-8000-000000000201',
  'venue_manager',
  app_private.invitation_token_hash('invite-escalation-v1'),
  '00000000-0000-4000-8000-000000000020',
  now() + interval '7 days',
  'pending'
);

SELECT pg_temp.impersonate(
  '00000000-0000-4000-8000-0000000000a5',
  'already.staff@example.com'
);

SELECT is(
  public.accept_invitation('invite-escalation-v1') ->> 'code',
  'membership_conflict',
  'C2: invitation cannot escalate an existing venue role'
);

SELECT is(
  (SELECT role FROM public.venue_memberships
   WHERE user_id = '00000000-0000-4000-8000-0000000000a5'
     AND venue_id = '00000000-0000-4000-8000-000000000201'
     AND deactivated_at IS NULL),
  'staff',
  'existing staff role is unchanged after rejected escalation'
);

-- ---------------------------------------------------------------------------
-- Deactivated user (C15)
-- ---------------------------------------------------------------------------

SELECT pg_temp.as_postgres();

INSERT INTO public.invitations (
  id, email, scope_type, venue_id, role, token_hash, invited_by, expires_at, state
) VALUES (
  '00000000-0000-4000-8000-0000000007a7',
  'deactivated.user@example.com',
  'venue',
  '00000000-0000-4000-8000-000000000202',
  'staff',
  app_private.invitation_token_hash('invite-deactivated-v1'),
  '00000000-0000-4000-8000-000000000020',
  now() + interval '7 days',
  'pending'
);

SELECT pg_temp.impersonate(
  '00000000-0000-4000-8000-000000000026',
  'deactivated.user@example.com'
);

SELECT is(
  public.accept_invitation('invite-deactivated-v1') ->> 'code',
  'account_inactive',
  'C15: deactivated users cannot accept invitations'
);

-- ---------------------------------------------------------------------------
-- Unauthenticated accept
-- ---------------------------------------------------------------------------

SELECT pg_temp.impersonate_anon();

SELECT throws_ok(
  $$ SELECT public.accept_invitation('invite-wrong-email-v1') $$,
  '42501',
  NULL,
  'anon execute on accept_invitation is revoked'
);

-- ---------------------------------------------------------------------------
-- Double acceptance under one lock (serialized retries)
-- ---------------------------------------------------------------------------

SELECT pg_temp.as_postgres();

SELECT pg_temp.seed_invitee(
  '00000000-0000-4000-8000-0000000000a6',
  'double.accept@example.com',
  'pending'
);

INSERT INTO public.invitations (
  id, email, scope_type, venue_id, role, token_hash, invited_by, expires_at, state
) VALUES (
  '00000000-0000-4000-8000-0000000007a8',
  'double.accept@example.com',
  'venue',
  '00000000-0000-4000-8000-000000000202',
  'content_editor',
  app_private.invitation_token_hash('invite-double-v1'),
  '00000000-0000-4000-8000-000000000020',
  now() + interval '7 days',
  'pending'
);

SELECT pg_temp.impersonate(
  '00000000-0000-4000-8000-0000000000a6',
  'double.accept@example.com'
);

SELECT is(
  (public.accept_invitation('invite-double-v1') ->> 'ok')::boolean
    AND (public.accept_invitation('invite-double-v1') ->> 'idempotent')::boolean,
  true,
  'concurrent-style double submit: first writes, second is idempotent'
);

SELECT is(
  (SELECT count(*)::integer FROM public.venue_memberships
   WHERE user_id = '00000000-0000-4000-8000-0000000000a6'),
  1,
  'double accept still creates one membership'
);

-- ---------------------------------------------------------------------------
-- evaluate_permission (fail closed, C19)
-- ---------------------------------------------------------------------------

SELECT pg_temp.impersonate(
  '00000000-0000-4000-8000-000000000010',
  'harbor.owner@example.com'
);

SELECT ok(
  public.evaluate_permission(
    'manage_venue',
    'venue',
    '00000000-0000-4000-8000-000000000100',
    '00000000-0000-4000-8000-000000000101',
    NULL
  ),
  'harbor owner evaluate_permission manage_venue on harbor-light'
);

SELECT ok(
  NOT public.evaluate_permission(
    'manage_venue',
    'venue',
    '00000000-0000-4000-8000-000000000200',
    '00000000-0000-4000-8000-000000000202',
    NULL
  ),
  'harbor owner evaluate_permission denies atlas draft-room'
);

SELECT is(
  public.evaluate_permission(
    'manage_venue',
    'venue',
    '00000000-0000-4000-8000-000000000200',
    '00000000-0000-4000-8000-000000000202',
    NULL
  ),
  public.evaluate_permission(
    'manage_venue',
    'venue',
    '00000000-0000-4000-8000-000000000200',
    'ffffffff-ffff-4fff-8fff-ffffffffffff',
    NULL
  ),
  'foreign venue and unknown venue both deny without leaking membership'
);

SELECT ok(
  public.evaluate_permission(
    'manage_venue',
    'venue',
    '00000000-0000-4000-8000-000000000100',
    '00000000-0000-4000-8000-000000000101',
    '00000000-0000-4000-8000-000000000020'
  ),
  'p_target_user_id does not switch the evaluated actor'
);

SELECT ok(
  NOT public.evaluate_permission(
    'manage_venue',
    'venue',
    '00000000-0000-4000-8000-000000000200',
    '00000000-0000-4000-8000-000000000201',
    '00000000-0000-4000-8000-000000000020'
  ),
  'p_target_user_id cannot grant another tenant membership'
);

SELECT ok(
  NOT public.evaluate_permission(
    'not_a_real_action',
    'venue',
    '00000000-0000-4000-8000-000000000100',
    '00000000-0000-4000-8000-000000000101',
    NULL
  ),
  'unknown actions deny'
);

SELECT ok(
  NOT public.evaluate_permission('manage_venue', 'venue', NULL, NULL, NULL),
  'missing venue scope denies'
);

SELECT pg_temp.impersonate(
  '00000000-0000-4000-8000-000000000002',
  'platform.support@example.com'
);

SELECT ok(
  NOT public.evaluate_permission(
    'manage_venue',
    'venue',
    '00000000-0000-4000-8000-000000000200',
    '00000000-0000-4000-8000-000000000201',
    NULL
  ),
  'C19: platform support without a write session cannot manage tenant venue'
);

SELECT pg_temp.impersonate(
  '00000000-0000-4000-8000-000000000001',
  'platform.admin@example.com'
);

SELECT ok(
  public.evaluate_permission('moderate_content', 'platform', NULL, NULL, NULL),
  'platform_admin moderate_content does not require a support session'
);

SELECT ok(
  public.evaluate_permission('manage_platform_tenants', 'platform', NULL, NULL, NULL),
  'platform_admin may manage platform tenants on the platform scope'
);

SELECT pg_temp.impersonate(
  '00000000-0000-4000-8000-000000000021',
  'atlas.manager@example.com'
);

SELECT ok(
  NOT public.evaluate_permission(
    'invite_users',
    'venue',
    '00000000-0000-4000-8000-000000000200',
    '00000000-0000-4000-8000-000000000201',
    NULL
  ),
  'C1: venue_manager invite_users remains default-deny'
);

SELECT * FROM finish();

ROLLBACK;
