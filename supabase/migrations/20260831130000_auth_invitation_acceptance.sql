-- Authentication and invitation acceptance: inspect/accept RPCs, permission
-- evaluation for application can(), and execution grants. Forward-only.
-- Does not edit the three foundation migrations.

-- ---------------------------------------------------------------------------
-- Token hashing (private). The URL token never lands in invitations.token_hash.
-- ---------------------------------------------------------------------------

CREATE FUNCTION app_private.invitation_token_hash(p_token text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_token IS NULL OR pg_catalog.btrim(p_token) = '' THEN NULL
    ELSE pg_catalog.encode(
      extensions.digest(
        pg_catalog.convert_to(pg_catalog.btrim(p_token), 'UTF8'),
        'sha256'
      ),
      'hex'
    )
  END;
$$;

COMMENT ON FUNCTION app_private.invitation_token_hash(text) IS
  'SHA-256 hex of a trimmed invitation token. Used only by inspect/accept.';

CREATE FUNCTION app_private.jwt_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT pg_catalog.lower(pg_catalog.btrim(NULLIF(
    COALESCE(
      NULLIF(pg_catalog.current_setting('request.jwt.claim.email', true), ''),
      pg_catalog.jsonb_extract_path_text(
        NULLIF(pg_catalog.current_setting('request.jwt.claims', true), '')::pg_catalog.jsonb,
        'email'
      )
    ),
    ''
  )));
$$;

COMMENT ON FUNCTION app_private.jwt_email() IS
  'JWT email claim only. user_metadata is never consulted.';

CREATE FUNCTION app_private.normalized_email(p_email text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT NULLIF(pg_catalog.lower(pg_catalog.btrim(p_email)), '');
$$;

-- ---------------------------------------------------------------------------
-- Inspect: token holder may see invitation state, never whether an arbitrary
-- email has an account. Read-only; does not mutate expired rows.
-- ---------------------------------------------------------------------------

CREATE FUNCTION public.inspect_invitation(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_hash text;
  v_inv public.invitations%ROWTYPE;
  v_status text;
  v_venue_name text;
  v_business_name text;
BEGIN
  IF p_token IS NULL
     OR pg_catalog.char_length(p_token) < 16
     OR pg_catalog.char_length(p_token) > 128
     OR p_token !~ '^[A-Za-z0-9._~-]+$' THEN
    RETURN pg_catalog.jsonb_build_object('status', 'invalid');
  END IF;

  v_hash := app_private.invitation_token_hash(p_token);
  IF v_hash IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('status', 'invalid');
  END IF;

  SELECT * INTO v_inv
  FROM public.invitations i
  WHERE i.token_hash = v_hash;

  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('status', 'invalid');
  END IF;

  IF v_inv.state = 'revoked' THEN
    v_status := 'revoked';
  ELSIF v_inv.state = 'accepted' THEN
    v_status := 'accepted';
  ELSIF v_inv.state = 'expired' OR v_inv.expires_at <= pg_catalog.now() THEN
    v_status := 'expired';
  ELSIF v_inv.state = 'pending' THEN
    v_status := 'pending';
  ELSE
    RETURN pg_catalog.jsonb_build_object('status', 'invalid');
  END IF;

  IF v_status <> 'pending' THEN
    RETURN pg_catalog.jsonb_build_object('status', v_status);
  END IF;

  IF v_inv.venue_id IS NOT NULL THEN
    SELECT v.name INTO v_venue_name
    FROM public.venues v
    WHERE v.id = v_inv.venue_id;
  END IF;

  IF v_inv.business_id IS NOT NULL THEN
    SELECT b.name INTO v_business_name
    FROM public.businesses b
    WHERE b.id = v_inv.business_id;
  ELSIF v_inv.venue_id IS NOT NULL THEN
    SELECT b.name INTO v_business_name
    FROM public.venues v
    JOIN public.businesses b ON b.id = v.business_id
    WHERE v.id = v_inv.venue_id;
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'status', v_status,
    'scope_type', v_inv.scope_type,
    'role', v_inv.role,
    'email', v_inv.email,
    'expires_at', v_inv.expires_at,
    'venue_name', v_venue_name,
    'business_name', v_business_name
  );
END;
$$;

COMMENT ON FUNCTION public.inspect_invitation(text) IS
  'Returns invitation state for a raw token. Non-pending results are status-only. Pending results omit tenant UUIDs. Missing tokens are invalid. Does not disclose whether an email has an account.';

-- ---------------------------------------------------------------------------
-- Accept: one transaction, invitation row locked. Tenant ids and role come
-- from the stored invitation. Idempotent if the same user already accepted.
-- ---------------------------------------------------------------------------

CREATE FUNCTION public.accept_invitation(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_hash text;
  v_inv public.invitations%ROWTYPE;
  v_user_id uuid;
  v_user public.users%ROWTYPE;
  v_auth_email text;
  v_membership_id uuid;
  v_existing_role text;
  v_existing_status text;
  v_existing_deactivated timestamptz;
  v_venue_business uuid;
  v_now timestamptz := pg_catalog.now();
  v_platform_roles text[] := ARRAY['platform_admin', 'platform_support'];
BEGIN
  v_user_id := app_private.current_user_id();
  IF v_user_id IS NULL OR app_private.jwt_role() IS DISTINCT FROM 'authenticated' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'unauthenticated');
  END IF;

  IF p_token IS NULL
     OR pg_catalog.char_length(p_token) < 16
     OR pg_catalog.char_length(p_token) > 128
     OR p_token !~ '^[A-Za-z0-9._~-]+$' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invitation_unavailable');
  END IF;

  v_hash := app_private.invitation_token_hash(p_token);
  IF v_hash IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invitation_unavailable');
  END IF;

  SELECT * INTO v_inv
  FROM public.invitations i
  WHERE i.token_hash = v_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invitation_unavailable');
  END IF;

  SELECT * INTO v_user
  FROM public.users u
  WHERE u.id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invitation_unavailable');
  END IF;

  -- C15: pending may accept; deactivated and suspended may not.
  IF v_user.account_status IN ('deactivated', 'suspended')
     OR v_user.deactivated_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'account_inactive');
  END IF;

  v_auth_email := COALESCE(app_private.jwt_email(), app_private.normalized_email(v_user.email));
  IF v_auth_email IS NULL
     OR v_auth_email IS DISTINCT FROM app_private.normalized_email(v_inv.email) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'email_mismatch');
  END IF;

  IF v_inv.role = ANY (v_platform_roles)
     OR v_inv.scope_type NOT IN ('business', 'venue') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invitation_unavailable');
  END IF;

  IF v_inv.scope_type = 'business' THEN
    IF v_inv.business_id IS NULL
       OR v_inv.venue_id IS NOT NULL
       OR v_inv.role IS DISTINCT FROM 'business_owner'
       OR NOT EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = v_inv.business_id) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'invitation_unavailable');
    END IF;
  ELSE
    IF v_inv.venue_id IS NULL
       OR v_inv.business_id IS NOT NULL
       OR v_inv.role NOT IN ('venue_manager', 'content_editor', 'booking_manager', 'staff') THEN
      RETURN jsonb_build_object('ok', false, 'code', 'invitation_unavailable');
    END IF;

    SELECT v.business_id INTO v_venue_business
    FROM public.venues v
    WHERE v.id = v_inv.venue_id;

    IF v_venue_business IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'code', 'invitation_unavailable');
    END IF;
  END IF;

  -- Already accepted: same user + matching membership is a no-op success.
  IF v_inv.state = 'accepted' THEN
    IF v_inv.scope_type = 'venue' THEN
      SELECT m.id INTO v_membership_id
      FROM public.venue_memberships m
      WHERE m.venue_id = v_inv.venue_id
        AND m.user_id = v_user_id
        AND m.role = v_inv.role
        AND m.status = 'active'
        AND m.deactivated_at IS NULL;
    ELSE
      SELECT m.id INTO v_membership_id
      FROM public.business_memberships m
      WHERE m.business_id = v_inv.business_id
        AND m.user_id = v_user_id
        AND m.role = v_inv.role
        AND m.status = 'active'
        AND m.deactivated_at IS NULL;
    END IF;

    IF v_membership_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'ok', true,
        'idempotent', true,
        'scope_type', v_inv.scope_type,
        'role', v_inv.role,
        'venue_id', v_inv.venue_id,
        'business_id', v_inv.business_id,
        'membership_id', v_membership_id
      );
    END IF;

    RETURN jsonb_build_object('ok', false, 'code', 'invitation_unavailable');
  END IF;

  IF v_inv.state IS DISTINCT FROM 'pending'
     OR v_inv.revoked_at IS NOT NULL
     OR v_inv.expires_at <= v_now THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invitation_unavailable');
  END IF;

  IF v_inv.scope_type = 'venue' THEN
    SELECT m.id, m.role, m.status, m.deactivated_at
    INTO v_membership_id, v_existing_role, v_existing_status, v_existing_deactivated
    FROM public.venue_memberships m
    WHERE m.venue_id = v_inv.venue_id
      AND m.user_id = v_user_id
    ORDER BY CASE WHEN m.deactivated_at IS NULL THEN 0 ELSE 1 END, m.created_at
    FOR UPDATE
    LIMIT 1;

    IF v_membership_id IS NOT NULL AND v_existing_deactivated IS NULL THEN
      IF v_existing_status = 'active' AND v_existing_role = v_inv.role THEN
        UPDATE public.invitations
        SET state = 'accepted',
            accepted_at = v_now
        WHERE id = v_inv.id;

        IF v_user.account_status = 'pending' THEN
          UPDATE public.users
          SET account_status = 'active'
          WHERE id = v_user_id;
        END IF;

        RETURN jsonb_build_object(
          'ok', true,
          'idempotent', true,
          'scope_type', v_inv.scope_type,
          'role', v_inv.role,
          'venue_id', v_inv.venue_id,
          'business_id', v_inv.business_id,
          'membership_id', v_membership_id
        );
      END IF;

      -- Active membership at a different role would escalate or silently
      -- change rank. Invitation acceptance never does that (C2).
      RETURN jsonb_build_object('ok', false, 'code', 'membership_conflict');
    END IF;

    IF v_membership_id IS NOT NULL THEN
      UPDATE public.venue_memberships
      SET role = v_inv.role,
          status = 'active',
          invited_by = v_inv.invited_by,
          accepted_at = v_now,
          deactivated_at = NULL
      WHERE id = v_membership_id
      RETURNING id INTO v_membership_id;
    ELSE
      INSERT INTO public.venue_memberships (
        venue_id, user_id, role, status, invited_by, accepted_at
      )
      VALUES (
        v_inv.venue_id, v_user_id, v_inv.role, 'active', v_inv.invited_by, v_now
      )
      RETURNING id INTO v_membership_id;
    END IF;
  ELSE
    SELECT m.id, m.role, m.status, m.deactivated_at
    INTO v_membership_id, v_existing_role, v_existing_status, v_existing_deactivated
    FROM public.business_memberships m
    WHERE m.business_id = v_inv.business_id
      AND m.user_id = v_user_id
    ORDER BY CASE WHEN m.deactivated_at IS NULL THEN 0 ELSE 1 END, m.created_at
    FOR UPDATE
    LIMIT 1;

    IF v_membership_id IS NOT NULL AND v_existing_deactivated IS NULL THEN
      IF v_existing_status = 'active' AND v_existing_role = v_inv.role THEN
        UPDATE public.invitations
        SET state = 'accepted',
            accepted_at = v_now
        WHERE id = v_inv.id;

        IF v_user.account_status = 'pending' THEN
          UPDATE public.users
          SET account_status = 'active'
          WHERE id = v_user_id;
        END IF;

        RETURN jsonb_build_object(
          'ok', true,
          'idempotent', true,
          'scope_type', v_inv.scope_type,
          'role', v_inv.role,
          'venue_id', v_inv.venue_id,
          'business_id', v_inv.business_id,
          'membership_id', v_membership_id
        );
      END IF;

      RETURN jsonb_build_object('ok', false, 'code', 'membership_conflict');
    END IF;

    IF v_membership_id IS NOT NULL THEN
      UPDATE public.business_memberships
      SET role = v_inv.role,
          status = 'active',
          invited_by = v_inv.invited_by,
          accepted_at = v_now,
          deactivated_at = NULL
      WHERE id = v_membership_id
      RETURNING id INTO v_membership_id;
    ELSE
      INSERT INTO public.business_memberships (
        business_id, user_id, role, status, invited_by, accepted_at
      )
      VALUES (
        v_inv.business_id, v_user_id, v_inv.role, 'active', v_inv.invited_by, v_now
      )
      RETURNING id INTO v_membership_id;
    END IF;
  END IF;

  UPDATE public.invitations
  SET state = 'accepted',
      accepted_at = v_now
  WHERE id = v_inv.id;

  IF v_user.account_status = 'pending' THEN
    UPDATE public.users
    SET account_status = 'active'
    WHERE id = v_user_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'scope_type', v_inv.scope_type,
    'role', v_inv.role,
    'venue_id', v_inv.venue_id,
    'business_id', v_inv.business_id,
    'membership_id', v_membership_id
  );
END;
$$;

COMMENT ON FUNCTION public.accept_invitation(text) IS
  'Atomic invitation acceptance. Role, business_id and venue_id come from the stored invitation. Repeat submission by the same accepted member is idempotent. Cannot create platform roles.';

-- ---------------------------------------------------------------------------
-- Application permission evaluation. Fail-closed. Mirrors can() so the
-- catalogue is not copied into a second matrix; grants are read from
-- role_action_grants and conditional cells use conditional_tenant_grant_ok.
-- ---------------------------------------------------------------------------

CREATE FUNCTION public.evaluate_permission(
  p_action_key text,
  p_scope_type text,
  p_business_id uuid DEFAULT NULL,
  p_venue_id uuid DEFAULT NULL,
  p_target_user_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_default_scope text;
  v_platform_role text;
  v_grant_kind text;
  v_tenant_role text;
  v_write boolean;
BEGIN
  IF p_action_key IS NULL OR p_scope_type IS NULL THEN
    RETURN false;
  END IF;

  IF p_scope_type NOT IN ('platform', 'business', 'venue', 'self') THEN
    RETURN false;
  END IF;

  SELECT a.default_scope INTO v_default_scope
  FROM public.permission_actions a
  WHERE a.key = p_action_key;

  IF v_default_scope IS NULL THEN
    RETURN false;
  END IF;

  IF NOT app_private.is_user_active() THEN
    RETURN false;
  END IF;

  IF p_scope_type = 'venue' AND p_venue_id IS NULL THEN
    RETURN false;
  END IF;

  IF p_scope_type = 'business' AND p_business_id IS NULL THEN
    RETURN false;
  END IF;

  v_write := p_action_key IN (
    'manage_business',
    'manage_venue',
    'manage_branding',
    'invite_users',
    'assign_roles',
    'manage_public_staff_profiles',
    'toggle_staff_presence',
    'create_content',
    'approve_content',
    'publish_content',
    'manage_events',
    'manage_bookings',
    'export_data',
    'manage_venue_module_visibility',
    'manage_atmosphere',
    'manage_offers',
    'submit_content_for_approval',
    'manage_venue_domains',
    'manage_platform_entitlements',
    'manage_platform_tenants',
    'grant_support_write_access',
    'manage_platform_users',
    'moderate_content'
  );

  -- Tenant memberships first. Platform roles are never a shortcut around this.
  IF p_scope_type = 'venue' THEN
    IF app_private.has_tenant_action_on_venue(p_action_key, p_venue_id) THEN
      IF p_action_key = 'assign_roles'
         AND p_target_user_id IS NOT NULL
         AND p_target_user_id = app_private.current_user_id()
         AND NOT app_private.is_business_owner(app_private.venue_business_id(p_venue_id)) THEN
        RETURN false;
      END IF;
      RETURN true;
    END IF;
  ELSIF p_scope_type = 'business' THEN
    IF app_private.has_tenant_action_on_business(p_action_key, p_business_id) THEN
      RETURN true;
    END IF;
  ELSIF p_scope_type = 'self' THEN
    v_tenant_role := CASE
      WHEN p_venue_id IS NOT NULL THEN app_private.venue_membership_role(p_venue_id)
      ELSE NULL
    END;
    IF v_tenant_role IS NOT NULL
       AND app_private.effective_tenant_grant(v_tenant_role, p_action_key) THEN
      RETURN true;
    END IF;
    IF p_venue_id IS NOT NULL
       AND app_private.is_business_owner(app_private.venue_business_id(p_venue_id))
       AND app_private.effective_tenant_grant('business_owner', p_action_key) THEN
      RETURN true;
    END IF;
    IF p_action_key IN (
         'manage_own_public_profile',
         'manage_own_consent',
         'manage_notification_preferences'
       )
       AND app_private.is_user_active() THEN
      -- Own-account actions that do not require a venue membership.
      IF EXISTS (
        SELECT 1
        FROM public.role_action_grants g
        WHERE g.action_key = p_action_key
          AND g.grant_kind = 'allow'
          AND (
            g.role_key = v_tenant_role
            OR (
              p_venue_id IS NOT NULL
              AND g.role_key = 'business_owner'
              AND app_private.is_business_owner(app_private.venue_business_id(p_venue_id))
            )
            OR (
              app_private.is_platform_admin()
              AND g.role_key = 'platform_admin'
            )
          )
      ) THEN
        RETURN true;
      END IF;
    END IF;
  END IF;

  SELECT pr.role INTO v_platform_role
  FROM public.platform_roles pr
  WHERE pr.user_id = app_private.current_user_id()
    AND pr.revoked_at IS NULL
  ORDER BY CASE pr.role WHEN 'platform_admin' THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_platform_role IS NULL THEN
    RETURN false;
  END IF;

  SELECT g.grant_kind INTO v_grant_kind
  FROM public.role_action_grants g
  WHERE g.role_key = v_platform_role
    AND g.action_key = p_action_key;

  IF v_grant_kind IS NULL THEN
    RETURN false;
  END IF;

  IF p_action_key = 'moderate_content' THEN
    RETURN v_platform_role = 'platform_admin' AND v_grant_kind = 'allow';
  END IF;

  IF p_action_key IN (
    'manage_platform_entitlements',
    'manage_platform_tenants',
    'manage_platform_users',
    'start_support_session',
    'grant_support_write_access'
  ) THEN
    RETURN v_grant_kind = 'allow' AND p_scope_type = 'platform';
  END IF;

  IF p_scope_type = 'platform' THEN
    IF v_grant_kind = 'allow' THEN
      RETURN true;
    END IF;
    RETURN false;
  END IF;

  -- Remaining platform grants against tenant scopes require a live session.
  -- Writes (C19) need confirmed write access; reads (C11/C10) need any session.
  IF p_scope_type IN ('business', 'venue') THEN
    IF v_write THEN
      RETURN app_private.platform_may_write_tenant(p_business_id, p_venue_id);
    END IF;
    RETURN app_private.platform_may_read_tenant(p_business_id, p_venue_id);
  END IF;

  RETURN false;
END;
$$;

COMMENT ON FUNCTION public.evaluate_permission(text, text, uuid, uuid, uuid) IS
  'Fail-closed application permission check. RLS remains the final boundary. Unknown actions and missing scopes deny. Conditional tenant grants use effective_tenant_grant.';

-- ---------------------------------------------------------------------------
-- Grants: revoke PUBLIC, grant least privilege.
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION app_private.invitation_token_hash(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.invitation_token_hash(text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION app_private.jwt_email() FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.jwt_email() FROM anon, authenticated;
REVOKE ALL ON FUNCTION app_private.normalized_email(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.normalized_email(text) FROM anon, authenticated;

REVOKE ALL ON FUNCTION public.inspect_invitation(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_invitation(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.evaluate_permission(text, text, uuid, uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.inspect_invitation(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_invitation(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.evaluate_permission(text, text, uuid, uuid, uuid) TO authenticated;
