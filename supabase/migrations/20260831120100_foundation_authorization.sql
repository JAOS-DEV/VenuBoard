-- VenuBoard foundation authorisation: helpers, RLS, grants.
--
-- Security assumptions:
-- * Helpers are SECURITY DEFINER with an empty search_path so they cannot be
--   hijacked by a malicious search_path, and they query membership tables as
--   the definer (avoiding recursive RLS).
-- * current_user_id() reads JWT `sub` only — never user_metadata.
-- * Platform roles grant no tenant access by themselves. Tenant data for
--   platform users requires an open support session, except moderate_content
--   (via apply_venue_moderation) and platform-record tables.
-- * Conditional matrix cells default to deny at RLS unless the condition can
--   be checked against data that already exists. Application `can()` must
--   not be treated as the security boundary (see
--   docs/security/conditional-permission-enforcement.md).
-- * Policies are per-command, never FOR ALL.

-- ---------------------------------------------------------------------------
-- Identity helpers
-- ---------------------------------------------------------------------------

CREATE FUNCTION app_private.current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT NULLIF(
    COALESCE(
      NULLIF(pg_catalog.current_setting('request.jwt.claim.sub', true), ''),
      pg_catalog.jsonb_extract_path_text(
        NULLIF(pg_catalog.current_setting('request.jwt.claims', true), '')::pg_catalog.jsonb,
        'sub'
      )
    ),
    ''
  )::uuid;
$$;

COMMENT ON FUNCTION app_private.current_user_id() IS
  'JWT sub only. user_metadata is never consulted for identity or grants.';

CREATE FUNCTION app_private.jwt_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    NULLIF(pg_catalog.current_setting('request.jwt.claim.role', true), ''),
    pg_catalog.jsonb_extract_path_text(
      NULLIF(pg_catalog.current_setting('request.jwt.claims', true), '')::pg_catalog.jsonb,
      'role'
    ),
    CURRENT_USER
  );
$$;

CREATE FUNCTION app_private.is_user_active()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = app_private.current_user_id()
      AND u.account_status = 'active'
      AND u.deactivated_at IS NULL
  );
$$;

CREATE FUNCTION app_private.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app_private.is_user_active()
    AND EXISTS (
      SELECT 1
      FROM public.platform_roles r
      WHERE r.user_id = app_private.current_user_id()
        AND r.role = 'platform_admin'
        AND r.revoked_at IS NULL
    );
$$;

CREATE FUNCTION app_private.is_platform_support()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app_private.is_user_active()
    AND EXISTS (
      SELECT 1
      FROM public.platform_roles r
      WHERE r.user_id = app_private.current_user_id()
        AND r.role = 'platform_support'
        AND r.revoked_at IS NULL
    );
$$;

CREATE FUNCTION app_private.is_business_owner(p_business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app_private.is_user_active()
    AND p_business_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.business_memberships m
      WHERE m.business_id = p_business_id
        AND m.user_id = app_private.current_user_id()
        AND m.role = 'business_owner'
        AND m.status = 'active'
        AND m.deactivated_at IS NULL
    );
$$;

CREATE FUNCTION app_private.venue_business_id(p_venue_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT v.business_id FROM public.venues v WHERE v.id = p_venue_id;
$$;

CREATE FUNCTION app_private.venue_membership_role(p_venue_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT m.role
  FROM public.venue_memberships m
  WHERE m.venue_id = p_venue_id
    AND m.user_id = app_private.current_user_id()
    AND m.status = 'active'
    AND m.deactivated_at IS NULL;
$$;

CREATE FUNCTION app_private.is_tenant_of_venue(p_venue_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app_private.is_user_active()
    AND p_venue_id IS NOT NULL
    AND (
      app_private.is_business_owner(app_private.venue_business_id(p_venue_id))
      OR app_private.venue_membership_role(p_venue_id) IS NOT NULL
    );
$$;

CREATE FUNCTION app_private.is_tenant_of_business(p_business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app_private.is_business_owner(p_business_id)
    OR EXISTS (
      SELECT 1
      FROM public.venues v
      WHERE v.business_id = p_business_id
        AND app_private.venue_membership_role(v.id) IS NOT NULL
    );
$$;

CREATE FUNCTION app_private.subscription_state(p_venue_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT s.state FROM public.subscriptions s WHERE s.venue_id = p_venue_id;
$$;

CREATE FUNCTION app_private.subscription_allows_public(p_venue_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app_private.subscription_state(p_venue_id) IN (
    'trial', 'active', 'past_due', 'restricted'
  );
$$;

CREATE FUNCTION app_private.subscription_allows_tenant_writes(p_venue_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  -- C16: restricted/suspended/cancelled/deleted block configuration writes.
  SELECT app_private.subscription_state(p_venue_id) IN (
    'trial', 'active', 'past_due'
  );
$$;

CREATE FUNCTION app_private.venue_is_publicly_visible(p_venue_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.venues v
    WHERE v.id = p_venue_id
      AND v.publication_state = 'published'
      AND v.platform_quarantined_at IS NULL
      AND v.archived_at IS NULL
      AND v.status = 'active'
      AND app_private.subscription_allows_public(v.id)
  );
$$;

CREATE FUNCTION app_private.module_is_entitled(p_venue_id uuid, p_module_key text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  sub_state text;
  has_deny boolean;
  has_allow boolean;
BEGIN
  IF p_module_key = 'core_profile' THEN
    RETURN EXISTS (SELECT 1 FROM public.venues v WHERE v.id = p_venue_id);
  END IF;

  sub_state := app_private.subscription_state(p_venue_id);
  IF sub_state IS NULL OR sub_state IN ('suspended', 'deleted', 'scheduled_for_deletion') THEN
    RETURN false;
  END IF;

  SELECT
    bool_or(e.grant_type = 'deny' AND e.source_key = 'override'),
    bool_or(e.grant_type = 'allow')
  INTO has_deny, has_allow
  FROM public.venue_module_entitlements e
  WHERE e.venue_id = p_venue_id
    AND e.module_key = p_module_key
    AND e.revoked_at IS NULL
    AND e.starts_at <= pg_catalog.now()
    AND (e.ends_at IS NULL OR e.ends_at > pg_catalog.now());

  IF COALESCE(has_deny, false) THEN
    RETURN false;
  END IF;

  RETURN COALESCE(has_allow, false);
END;
$$;

CREATE FUNCTION app_private.active_support_session_covers(
  p_business_id uuid,
  p_venue_id uuid
)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT s.id
  FROM public.support_sessions s
  WHERE s.operator_user_id = app_private.current_user_id()
    AND s.ended_at IS NULL
    AND s.expires_at > pg_catalog.now()
    AND (
      (p_venue_id IS NOT NULL AND s.target_venue_id = p_venue_id)
      OR (
        p_business_id IS NOT NULL
        AND s.target_business_id = p_business_id
      )
      OR (
        p_venue_id IS NOT NULL
        AND s.target_business_id = app_private.venue_business_id(p_venue_id)
      )
    )
  ORDER BY s.started_at DESC
  LIMIT 1;
$$;

CREATE FUNCTION app_private.platform_may_read_tenant(
  p_business_id uuid,
  p_venue_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (app_private.is_platform_admin() OR app_private.is_platform_support())
    AND app_private.active_support_session_covers(p_business_id, p_venue_id) IS NOT NULL;
$$;

CREATE FUNCTION app_private.platform_may_write_tenant(
  p_business_id uuid,
  p_venue_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app_private.is_platform_admin()
    AND EXISTS (
      SELECT 1
      FROM public.support_sessions s
      WHERE s.id = app_private.active_support_session_covers(p_business_id, p_venue_id)
        AND s.mode = 'write'
        AND s.write_granted_at IS NOT NULL
        AND s.write_expires_at IS NOT NULL
        AND s.write_expires_at > pg_catalog.now()
    );
$$;

CREATE FUNCTION app_private.role_grants_action(p_role_key text, p_action_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.role_action_grants g
    WHERE g.role_key = p_role_key
      AND g.action_key = p_action_key
      AND g.grant_kind IN ('allow', 'conditional')
  );
$$;

CREATE FUNCTION app_private.has_tenant_action_on_venue(p_action_key text, p_venue_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app_private.is_user_active()
    AND p_venue_id IS NOT NULL
    AND (
      (
        app_private.is_business_owner(app_private.venue_business_id(p_venue_id))
        AND app_private.role_grants_action('business_owner', p_action_key)
      )
      OR app_private.role_grants_action(
        app_private.venue_membership_role(p_venue_id),
        p_action_key
      )
    );
$$;

CREATE FUNCTION app_private.has_tenant_action_on_business(p_action_key text, p_business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app_private.is_business_owner(p_business_id)
    AND app_private.role_grants_action('business_owner', p_action_key);
$$;

CREATE FUNCTION app_private.has_platform_action(p_action_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app_private.is_user_active()
    AND (
      (app_private.is_platform_admin() AND app_private.role_grants_action('platform_admin', p_action_key))
      OR (app_private.is_platform_support() AND app_private.role_grants_action('platform_support', p_action_key))
    );
$$;

-- Attach remaining data-integrity triggers now that is_platform_admin exists.

CREATE TRIGGER users_protect_account_fields
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION app_private.protect_user_account_fields();

CREATE TRIGGER venues_protect_platform_columns
  BEFORE UPDATE ON public.venues
  FOR EACH ROW
  EXECUTE FUNCTION app_private.protect_venue_platform_columns();

CREATE FUNCTION app_private.reject_unentitled_module_enable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.is_enabled
     AND NOT app_private.module_is_entitled(NEW.venue_id, NEW.module_key) THEN
    RAISE EXCEPTION 'cannot enable a module that is not entitled'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER venue_module_settings_require_entitlement
  BEFORE INSERT OR UPDATE ON public.venue_module_settings
  FOR EACH ROW
  EXECUTE FUNCTION app_private.reject_unentitled_module_enable();

-- Platform-only moderation path: does not require a support session (ADR-036).
CREATE FUNCTION app_private.apply_venue_moderation(
  p_venue_id uuid,
  p_action text,
  p_reason text,
  p_evidence_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  previous jsonb;
  resulting jsonb;
  action_id uuid;
  audit_id uuid;
BEGIN
  IF NOT app_private.is_platform_admin() THEN
    RAISE EXCEPTION 'moderate_content is restricted to platform_admin'
      USING ERRCODE = '42501';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'moderation reason is required'
      USING ERRCODE = '23514';
  END IF;

  IF p_action NOT IN ('quarantine', 'unpublish', 'restore') THEN
    RAISE EXCEPTION 'unknown moderation action'
      USING ERRCODE = '23514';
  END IF;

  SELECT jsonb_build_object(
    'publication_state', v.publication_state,
    'platform_quarantined_at', v.platform_quarantined_at,
    'platform_quarantine_reason', v.platform_quarantine_reason
  )
  INTO previous
  FROM public.venues v
  WHERE v.id = p_venue_id;

  IF previous IS NULL THEN
    RAISE EXCEPTION 'venue not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF p_action IN ('quarantine', 'unpublish') THEN
    UPDATE public.venues
    SET
      publication_state = 'unpublished_by_platform',
      platform_quarantined_at = CASE
        WHEN p_action = 'quarantine' THEN pg_catalog.now()
        ELSE platform_quarantined_at
      END,
      platform_quarantine_reason = CASE
        WHEN p_action = 'quarantine' THEN trim(p_reason)
        ELSE platform_quarantine_reason
      END,
      platform_quarantined_by = CASE
        WHEN p_action = 'quarantine' THEN app_private.current_user_id()
        ELSE platform_quarantined_by
      END
    WHERE id = p_venue_id;
  ELSE
    UPDATE public.venues
    SET
      publication_state = 'draft',
      platform_quarantined_at = NULL,
      platform_quarantine_reason = NULL,
      platform_quarantined_by = NULL
    WHERE id = p_venue_id;
  END IF;

  SELECT jsonb_build_object(
    'publication_state', v.publication_state,
    'platform_quarantined_at', v.platform_quarantined_at,
    'platform_quarantine_reason', v.platform_quarantine_reason
  )
  INTO resulting
  FROM public.venues v
  WHERE v.id = p_venue_id;

  INSERT INTO public.audit_log (
    actor_user_id,
    actor_platform_role,
    action,
    scope_type,
    venue_id,
    business_id,
    target_table,
    target_id,
    summary,
    previous_state,
    resulting_state,
    outcome,
    environment
  )
  VALUES (
    app_private.current_user_id(),
    'platform_admin',
    'moderate_content',
    'venue',
    p_venue_id,
    app_private.venue_business_id(p_venue_id),
    'venues',
    p_venue_id,
    p_action || ': ' || trim(p_reason),
    previous,
    resulting,
    'success',
    'local'
  )
  RETURNING id INTO audit_id;

  INSERT INTO public.moderation_actions (
    platform_user_id,
    venue_id,
    target_table,
    target_id,
    action,
    previous_state,
    resulting_state,
    reason,
    evidence_note,
    audit_log_id
  )
  VALUES (
    app_private.current_user_id(),
    p_venue_id,
    'venues',
    p_venue_id,
    p_action,
    previous,
    resulting,
    trim(p_reason),
    p_evidence_note,
    audit_id
  )
  RETURNING id INTO action_id;

  RETURN action_id;
END;
$$;

COMMENT ON FUNCTION app_private.apply_venue_moderation(uuid, text, text, text) IS
  'ADR-036: platform_admin takedown/restore without a support session. Reason required. Does not author content.';

-- ---------------------------------------------------------------------------
-- Grants (auto_expose_new_tables = false)
-- ---------------------------------------------------------------------------

GRANT USAGE ON SCHEMA app_private TO anon, authenticated;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app_private FROM PUBLIC;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app_private TO anon, authenticated;

GRANT SELECT ON public.modules TO anon, authenticated;
GRANT SELECT ON public.plans TO authenticated;
GRANT SELECT ON public.plan_modules TO authenticated;
GRANT SELECT ON public.entitlement_sources TO authenticated;
GRANT SELECT ON public.fixed_roles TO authenticated;
GRANT SELECT ON public.permission_actions TO authenticated;
GRANT SELECT ON public.role_action_grants TO authenticated;
GRANT SELECT ON public.reserved_venue_slugs TO authenticated;

GRANT SELECT ON public.users TO authenticated;
GRANT UPDATE ON public.users TO authenticated;

GRANT SELECT ON public.platform_roles TO authenticated;
GRANT INSERT, UPDATE ON public.platform_roles TO authenticated;

GRANT SELECT ON public.businesses TO authenticated;
GRANT INSERT, UPDATE ON public.businesses TO authenticated;

GRANT SELECT ON public.venues TO anon, authenticated;
GRANT INSERT, UPDATE ON public.venues TO authenticated;

GRANT SELECT ON public.venue_translations TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.venue_translations TO authenticated;

GRANT SELECT ON public.business_memberships TO authenticated;
GRANT INSERT, UPDATE ON public.business_memberships TO authenticated;

GRANT SELECT ON public.venue_memberships TO authenticated;
GRANT INSERT, UPDATE ON public.venue_memberships TO authenticated;

GRANT SELECT, INSERT, UPDATE ON public.invitations TO authenticated;

GRANT SELECT ON public.subscriptions TO authenticated;
GRANT INSERT, UPDATE ON public.subscriptions TO authenticated;

GRANT SELECT ON public.venue_billing_records TO authenticated;
GRANT INSERT, UPDATE ON public.venue_billing_records TO authenticated;

GRANT SELECT ON public.venue_module_entitlements TO authenticated;
GRANT INSERT, UPDATE ON public.venue_module_entitlements TO authenticated;

GRANT SELECT ON public.venue_module_settings TO anon, authenticated;
GRANT INSERT, UPDATE ON public.venue_module_settings TO authenticated;

GRANT SELECT ON public.venue_module_setting_translations TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.venue_module_setting_translations TO authenticated;

GRANT SELECT ON public.venue_storage_usage TO authenticated;
GRANT INSERT, UPDATE ON public.venue_storage_usage TO authenticated;

GRANT SELECT ON public.trial_extensions TO authenticated;
GRANT INSERT ON public.trial_extensions TO authenticated;

GRANT SELECT, INSERT, UPDATE ON public.support_sessions TO authenticated;

GRANT SELECT ON public.audit_log TO authenticated;
GRANT INSERT ON public.audit_log TO authenticated;

GRANT SELECT, INSERT ON public.moderation_actions TO authenticated;

GRANT SELECT ON public.business_subscription_overview TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users FORCE ROW LEVEL SECURITY;
ALTER TABLE public.platform_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_roles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_roles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.permission_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permission_actions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.role_action_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_action_grants FORCE ROW LEVEL SECURITY;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules FORCE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans FORCE ROW LEVEL SECURITY;
ALTER TABLE public.plan_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_modules FORCE ROW LEVEL SECURITY;
ALTER TABLE public.entitlement_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entitlement_sources FORCE ROW LEVEL SECURITY;
ALTER TABLE public.reserved_venue_slugs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reserved_venue_slugs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.businesses FORCE ROW LEVEL SECURITY;
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venues FORCE ROW LEVEL SECURITY;
ALTER TABLE public.venue_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_translations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.business_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE public.venue_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.venue_billing_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_billing_records FORCE ROW LEVEL SECURITY;
ALTER TABLE public.venue_module_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_module_entitlements FORCE ROW LEVEL SECURITY;
ALTER TABLE public.venue_module_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_module_settings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.venue_module_setting_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_module_setting_translations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.venue_storage_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_storage_usage FORCE ROW LEVEL SECURITY;
ALTER TABLE public.trial_extensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trial_extensions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.support_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log FORCE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_actions FORCE ROW LEVEL SECURITY;

-- Reference catalogues: readable, not tenant-writable.
CREATE POLICY fixed_roles_select_authenticated ON public.fixed_roles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY permission_actions_select_authenticated ON public.permission_actions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY role_action_grants_select_authenticated ON public.role_action_grants
  FOR SELECT TO authenticated USING (true);

CREATE POLICY modules_select_anon ON public.modules
  FOR SELECT TO anon USING (true);

CREATE POLICY modules_select_authenticated ON public.modules
  FOR SELECT TO authenticated USING (true);

CREATE POLICY plans_select_authenticated ON public.plans
  FOR SELECT TO authenticated USING (true);

CREATE POLICY plan_modules_select_authenticated ON public.plan_modules
  FOR SELECT TO authenticated USING (true);

CREATE POLICY entitlement_sources_select_authenticated ON public.entitlement_sources
  FOR SELECT TO authenticated USING (true);

CREATE POLICY reserved_venue_slugs_select_authenticated ON public.reserved_venue_slugs
  FOR SELECT TO authenticated USING (true);

-- users
CREATE POLICY users_select_self ON public.users
  FOR SELECT TO authenticated
  USING (id = app_private.current_user_id());

CREATE POLICY users_select_same_tenant ON public.users
  FOR SELECT TO authenticated
  USING (
    app_private.is_user_active()
    AND EXISTS (
      SELECT 1
      FROM public.business_memberships mine
      JOIN public.business_memberships theirs
        ON theirs.business_id = mine.business_id
      WHERE mine.user_id = app_private.current_user_id()
        AND mine.status = 'active'
        AND mine.deactivated_at IS NULL
        AND theirs.user_id = users.id
    )
    OR EXISTS (
      SELECT 1
      FROM public.venue_memberships mine
      JOIN public.venue_memberships theirs
        ON theirs.venue_id = mine.venue_id
      WHERE mine.user_id = app_private.current_user_id()
        AND mine.status = 'active'
        AND mine.deactivated_at IS NULL
        AND theirs.user_id = users.id
    )
    OR EXISTS (
      SELECT 1
      FROM public.business_memberships owners
      JOIN public.venues v ON v.business_id = owners.business_id
      JOIN public.venue_memberships theirs ON theirs.venue_id = v.id
      WHERE owners.user_id = app_private.current_user_id()
        AND owners.status = 'active'
        AND owners.deactivated_at IS NULL
        AND theirs.user_id = users.id
    )
  );

CREATE POLICY users_select_platform ON public.users
  FOR SELECT TO authenticated
  USING (app_private.has_platform_action('manage_platform_users'));

CREATE POLICY users_update_self ON public.users
  FOR UPDATE TO authenticated
  USING (id = app_private.current_user_id() AND app_private.is_user_active())
  WITH CHECK (id = app_private.current_user_id() AND app_private.is_user_active());

CREATE POLICY users_update_platform ON public.users
  FOR UPDATE TO authenticated
  USING (app_private.has_platform_action('manage_platform_users'))
  WITH CHECK (app_private.has_platform_action('manage_platform_users'));

-- platform_roles: platform_admin only for writes; readable by platform roles.
CREATE POLICY platform_roles_select_platform ON public.platform_roles
  FOR SELECT TO authenticated
  USING (
    user_id = app_private.current_user_id()
    OR app_private.has_platform_action('manage_platform_users')
  );

CREATE POLICY platform_roles_insert_admin ON public.platform_roles
  FOR INSERT TO authenticated
  WITH CHECK (app_private.has_platform_action('manage_platform_users'));

CREATE POLICY platform_roles_update_admin ON public.platform_roles
  FOR UPDATE TO authenticated
  USING (app_private.has_platform_action('manage_platform_users'))
  WITH CHECK (app_private.has_platform_action('manage_platform_users'));

-- businesses
CREATE POLICY businesses_select_member ON public.businesses
  FOR SELECT TO authenticated
  USING (
    app_private.is_tenant_of_business(id)
    OR app_private.has_platform_action('manage_platform_tenants')
    OR app_private.platform_may_read_tenant(id, NULL)
  );

CREATE POLICY businesses_insert_platform ON public.businesses
  FOR INSERT TO authenticated
  WITH CHECK (app_private.has_platform_action('manage_platform_tenants'));

CREATE POLICY businesses_update_owner ON public.businesses
  FOR UPDATE TO authenticated
  USING (app_private.has_tenant_action_on_business('manage_business', id))
  WITH CHECK (app_private.has_tenant_action_on_business('manage_business', id));

CREATE POLICY businesses_update_platform ON public.businesses
  FOR UPDATE TO authenticated
  USING (app_private.has_platform_action('manage_platform_tenants'))
  WITH CHECK (app_private.has_platform_action('manage_platform_tenants'));

-- venues
CREATE POLICY venues_select_public ON public.venues
  FOR SELECT TO anon, authenticated
  USING (app_private.venue_is_publicly_visible(id));

CREATE POLICY venues_select_member ON public.venues
  FOR SELECT TO authenticated
  USING (
    app_private.is_tenant_of_venue(id)
    OR app_private.has_platform_action('manage_platform_tenants')
    OR app_private.platform_may_read_tenant(business_id, id)
  );

CREATE POLICY venues_insert_owner ON public.venues
  FOR INSERT TO authenticated
  WITH CHECK (
    app_private.has_tenant_action_on_business('manage_business', business_id)
    OR app_private.has_platform_action('manage_platform_tenants')
  );

CREATE POLICY venues_update_manager ON public.venues
  FOR UPDATE TO authenticated
  USING (
    app_private.has_tenant_action_on_venue('manage_venue', id)
    AND app_private.subscription_allows_tenant_writes(id)
  )
  WITH CHECK (
    app_private.has_tenant_action_on_venue('manage_venue', id)
    AND app_private.subscription_allows_tenant_writes(id)
  );

CREATE POLICY venues_update_platform_session ON public.venues
  FOR UPDATE TO authenticated
  USING (app_private.platform_may_write_tenant(business_id, id))
  WITH CHECK (app_private.platform_may_write_tenant(business_id, id));

CREATE POLICY venues_update_platform_records ON public.venues
  FOR UPDATE TO authenticated
  USING (app_private.has_platform_action('manage_platform_tenants'))
  WITH CHECK (app_private.has_platform_action('manage_platform_tenants'));

-- venue_translations: public read follows parent visibility (not merely venue_id).
CREATE POLICY venue_translations_select_public ON public.venue_translations
  FOR SELECT TO anon, authenticated
  USING (app_private.venue_is_publicly_visible(venue_id));

CREATE POLICY venue_translations_select_member ON public.venue_translations
  FOR SELECT TO authenticated
  USING (
    app_private.is_tenant_of_venue(venue_id)
    OR app_private.has_platform_action('manage_platform_tenants')
    OR app_private.platform_may_read_tenant(app_private.venue_business_id(venue_id), venue_id)
  );

CREATE POLICY venue_translations_insert_manager ON public.venue_translations
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      app_private.has_tenant_action_on_venue('manage_venue', venue_id)
      AND app_private.subscription_allows_tenant_writes(venue_id)
    )
    OR app_private.platform_may_write_tenant(
      app_private.venue_business_id(venue_id),
      venue_id
    )
  );

CREATE POLICY venue_translations_update_manager ON public.venue_translations
  FOR UPDATE TO authenticated
  USING (
    (
      app_private.has_tenant_action_on_venue('manage_venue', venue_id)
      AND app_private.subscription_allows_tenant_writes(venue_id)
    )
    OR app_private.platform_may_write_tenant(
      app_private.venue_business_id(venue_id),
      venue_id
    )
  )
  WITH CHECK (
    (
      app_private.has_tenant_action_on_venue('manage_venue', venue_id)
      AND app_private.subscription_allows_tenant_writes(venue_id)
    )
    OR app_private.platform_may_write_tenant(
      app_private.venue_business_id(venue_id),
      venue_id
    )
  );

CREATE POLICY venue_translations_delete_manager ON public.venue_translations
  FOR DELETE TO authenticated
  USING (
    app_private.has_tenant_action_on_venue('manage_venue', venue_id)
    AND app_private.subscription_allows_tenant_writes(venue_id)
  );

-- memberships
CREATE POLICY business_memberships_select ON public.business_memberships
  FOR SELECT TO authenticated
  USING (
    user_id = app_private.current_user_id()
    OR app_private.is_tenant_of_business(business_id)
    OR app_private.has_platform_action('manage_platform_tenants')
    OR app_private.platform_may_read_tenant(business_id, NULL)
  );

CREATE POLICY business_memberships_insert ON public.business_memberships
  FOR INSERT TO authenticated
  WITH CHECK (
    app_private.has_tenant_action_on_business('assign_roles', business_id)
    OR app_private.has_platform_action('manage_platform_tenants')
  );

CREATE POLICY business_memberships_update ON public.business_memberships
  FOR UPDATE TO authenticated
  USING (
    app_private.has_tenant_action_on_business('assign_roles', business_id)
    OR app_private.has_platform_action('manage_platform_tenants')
  )
  WITH CHECK (
    app_private.has_tenant_action_on_business('assign_roles', business_id)
    OR app_private.has_platform_action('manage_platform_tenants')
  );

CREATE POLICY venue_memberships_select ON public.venue_memberships
  FOR SELECT TO authenticated
  USING (
    user_id = app_private.current_user_id()
    OR app_private.is_tenant_of_venue(venue_id)
    OR app_private.has_platform_action('manage_platform_tenants')
    OR app_private.platform_may_read_tenant(app_private.venue_business_id(venue_id), venue_id)
  );

CREATE POLICY venue_memberships_insert ON public.venue_memberships
  FOR INSERT TO authenticated
  WITH CHECK (
    app_private.has_tenant_action_on_venue('assign_roles', venue_id)
    OR app_private.has_platform_action('manage_platform_tenants')
  );

CREATE POLICY venue_memberships_update ON public.venue_memberships
  FOR UPDATE TO authenticated
  USING (
    app_private.has_tenant_action_on_venue('assign_roles', venue_id)
    OR app_private.has_platform_action('manage_platform_tenants')
  )
  WITH CHECK (
    app_private.has_tenant_action_on_venue('assign_roles', venue_id)
    OR app_private.has_platform_action('manage_platform_tenants')
  );

-- invitations: private. No anonymous policy.
CREATE POLICY invitations_select ON public.invitations
  FOR SELECT TO authenticated
  USING (
    invited_by = app_private.current_user_id()
    OR (
      scope_type = 'business'
      AND app_private.has_tenant_action_on_business('invite_users', business_id)
    )
    OR (
      scope_type = 'venue'
      AND app_private.has_tenant_action_on_venue('invite_users', venue_id)
    )
    OR app_private.has_platform_action('manage_platform_tenants')
  );

CREATE POLICY invitations_insert ON public.invitations
  FOR INSERT TO authenticated
  WITH CHECK (
    invited_by = app_private.current_user_id()
    AND (
      (
        scope_type = 'business'
        AND app_private.has_tenant_action_on_business('invite_users', business_id)
      )
      OR (
        scope_type = 'venue'
        AND app_private.has_tenant_action_on_venue('invite_users', venue_id)
      )
      OR app_private.has_platform_action('manage_platform_tenants')
    )
  );

CREATE POLICY invitations_update ON public.invitations
  FOR UPDATE TO authenticated
  USING (
    (
      scope_type = 'business'
      AND app_private.has_tenant_action_on_business('invite_users', business_id)
    )
    OR (
      scope_type = 'venue'
      AND app_private.has_tenant_action_on_venue('invite_users', venue_id)
    )
    OR app_private.has_platform_action('manage_platform_tenants')
  )
  WITH CHECK (
    (
      scope_type = 'business'
      AND app_private.has_tenant_action_on_business('invite_users', business_id)
    )
    OR (
      scope_type = 'venue'
      AND app_private.has_tenant_action_on_venue('invite_users', venue_id)
    )
    OR app_private.has_platform_action('manage_platform_tenants')
  );

-- Commercial tenant-readable / platform-writable
CREATE POLICY subscriptions_select ON public.subscriptions
  FOR SELECT TO authenticated
  USING (
    app_private.is_tenant_of_venue(venue_id)
    OR app_private.has_platform_action('manage_platform_entitlements')
    OR app_private.platform_may_read_tenant(app_private.venue_business_id(venue_id), venue_id)
  );

CREATE POLICY subscriptions_insert_platform ON public.subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (app_private.has_platform_action('manage_platform_entitlements'));

CREATE POLICY subscriptions_update_platform ON public.subscriptions
  FOR UPDATE TO authenticated
  USING (app_private.has_platform_action('manage_platform_entitlements'))
  WITH CHECK (app_private.has_platform_action('manage_platform_entitlements'));

CREATE POLICY venue_billing_records_select ON public.venue_billing_records
  FOR SELECT TO authenticated
  USING (
    app_private.is_tenant_of_venue(venue_id)
    OR app_private.has_platform_action('manage_platform_entitlements')
  );

CREATE POLICY venue_billing_records_insert_platform ON public.venue_billing_records
  FOR INSERT TO authenticated
  WITH CHECK (app_private.has_platform_action('manage_platform_entitlements'));

CREATE POLICY venue_billing_records_update_platform ON public.venue_billing_records
  FOR UPDATE TO authenticated
  USING (app_private.has_platform_action('manage_platform_entitlements'))
  WITH CHECK (app_private.has_platform_action('manage_platform_entitlements'));

CREATE POLICY venue_module_entitlements_select ON public.venue_module_entitlements
  FOR SELECT TO authenticated
  USING (
    app_private.is_tenant_of_venue(venue_id)
    OR app_private.has_platform_action('manage_platform_entitlements')
  );

CREATE POLICY venue_module_entitlements_insert_platform ON public.venue_module_entitlements
  FOR INSERT TO authenticated
  WITH CHECK (app_private.has_platform_action('manage_platform_entitlements'));

CREATE POLICY venue_module_entitlements_update_platform ON public.venue_module_entitlements
  FOR UPDATE TO authenticated
  USING (app_private.has_platform_action('manage_platform_entitlements'))
  WITH CHECK (app_private.has_platform_action('manage_platform_entitlements'));

CREATE POLICY venue_storage_usage_select ON public.venue_storage_usage
  FOR SELECT TO authenticated
  USING (
    app_private.is_tenant_of_venue(venue_id)
    OR app_private.has_platform_action('manage_platform_entitlements')
  );

CREATE POLICY venue_storage_usage_insert_platform ON public.venue_storage_usage
  FOR INSERT TO authenticated
  WITH CHECK (app_private.has_platform_action('manage_platform_entitlements'));

CREATE POLICY venue_storage_usage_update_platform ON public.venue_storage_usage
  FOR UPDATE TO authenticated
  USING (app_private.has_platform_action('manage_platform_entitlements'))
  WITH CHECK (app_private.has_platform_action('manage_platform_entitlements'));

CREATE POLICY trial_extensions_select ON public.trial_extensions
  FOR SELECT TO authenticated
  USING (
    app_private.is_tenant_of_venue(venue_id)
    OR app_private.has_platform_action('manage_platform_entitlements')
  );

CREATE POLICY trial_extensions_insert_platform ON public.trial_extensions
  FOR INSERT TO authenticated
  WITH CHECK (app_private.has_platform_action('manage_platform_entitlements'));

-- Module visibility: tenant manage_venue_module_visibility; public read when
-- parent venue is public and the module is enabled and visible.
CREATE POLICY venue_module_settings_select_public ON public.venue_module_settings
  FOR SELECT TO anon, authenticated
  USING (
    is_enabled
    AND is_publicly_visible
    AND app_private.venue_is_publicly_visible(venue_id)
    AND app_private.module_is_entitled(venue_id, module_key)
  );

CREATE POLICY venue_module_settings_select_member ON public.venue_module_settings
  FOR SELECT TO authenticated
  USING (
    app_private.is_tenant_of_venue(venue_id)
    OR app_private.has_platform_action('manage_platform_tenants')
  );

CREATE POLICY venue_module_settings_insert_manager ON public.venue_module_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    app_private.has_tenant_action_on_venue('manage_venue_module_visibility', venue_id)
    AND app_private.subscription_allows_tenant_writes(venue_id)
  );

CREATE POLICY venue_module_settings_update_manager ON public.venue_module_settings
  FOR UPDATE TO authenticated
  USING (
    app_private.has_tenant_action_on_venue('manage_venue_module_visibility', venue_id)
    AND app_private.subscription_allows_tenant_writes(venue_id)
  )
  WITH CHECK (
    app_private.has_tenant_action_on_venue('manage_venue_module_visibility', venue_id)
    AND app_private.subscription_allows_tenant_writes(venue_id)
  );

CREATE POLICY venue_module_setting_translations_select_public
  ON public.venue_module_setting_translations
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.venue_module_settings s
      WHERE s.id = venue_module_setting_id
        AND s.venue_id = venue_module_setting_translations.venue_id
        AND s.is_enabled
        AND s.is_publicly_visible
        AND app_private.venue_is_publicly_visible(s.venue_id)
        AND app_private.module_is_entitled(s.venue_id, s.module_key)
    )
  );

CREATE POLICY venue_module_setting_translations_select_member
  ON public.venue_module_setting_translations
  FOR SELECT TO authenticated
  USING (app_private.is_tenant_of_venue(venue_id));

CREATE POLICY venue_module_setting_translations_write
  ON public.venue_module_setting_translations
  FOR INSERT TO authenticated
  WITH CHECK (
    app_private.has_tenant_action_on_venue('manage_venue_module_visibility', venue_id)
    AND app_private.subscription_allows_tenant_writes(venue_id)
  );

CREATE POLICY venue_module_setting_translations_update
  ON public.venue_module_setting_translations
  FOR UPDATE TO authenticated
  USING (
    app_private.has_tenant_action_on_venue('manage_venue_module_visibility', venue_id)
    AND app_private.subscription_allows_tenant_writes(venue_id)
  )
  WITH CHECK (
    app_private.has_tenant_action_on_venue('manage_venue_module_visibility', venue_id)
    AND app_private.subscription_allows_tenant_writes(venue_id)
  );

CREATE POLICY venue_module_setting_translations_delete
  ON public.venue_module_setting_translations
  FOR DELETE TO authenticated
  USING (
    app_private.has_tenant_action_on_venue('manage_venue_module_visibility', venue_id)
    AND app_private.subscription_allows_tenant_writes(venue_id)
  );

-- Support sessions: platform only. Tenants never write these rows.
CREATE POLICY support_sessions_select_platform ON public.support_sessions
  FOR SELECT TO authenticated
  USING (
    operator_user_id = app_private.current_user_id()
    OR app_private.has_platform_action('start_support_session')
  );

CREATE POLICY support_sessions_insert_platform ON public.support_sessions
  FOR INSERT TO authenticated
  WITH CHECK (
    operator_user_id = app_private.current_user_id()
    AND app_private.has_platform_action('start_support_session')
  );

CREATE POLICY support_sessions_update_platform ON public.support_sessions
  FOR UPDATE TO authenticated
  USING (
    operator_user_id = app_private.current_user_id()
    AND (
      app_private.has_platform_action('start_support_session')
      OR app_private.has_platform_action('grant_support_write_access')
    )
  )
  WITH CHECK (
    operator_user_id = app_private.current_user_id()
    AND (
      app_private.has_platform_action('start_support_session')
      OR app_private.has_platform_action('grant_support_write_access')
    )
  );

-- audit_log: no anonymous access. Tenants with view_audit_log may read their
-- scope. Inserts are not granted to venue users via a permissive policy —
-- only platform roles (and the SECURITY DEFINER moderation helper).
CREATE POLICY audit_log_select_platform ON public.audit_log
  FOR SELECT TO authenticated
  USING (app_private.has_platform_action('view_audit_log') AND (
    app_private.is_platform_admin() OR app_private.is_platform_support()
  ));

CREATE POLICY audit_log_select_tenant ON public.audit_log
  FOR SELECT TO authenticated
  USING (
    (
      venue_id IS NOT NULL
      AND app_private.has_tenant_action_on_venue('view_audit_log', venue_id)
      AND actor_platform_role IS NULL
    )
    OR (
      business_id IS NOT NULL
      AND venue_id IS NULL
      AND app_private.has_tenant_action_on_business('view_audit_log', business_id)
      AND actor_platform_role IS NULL
    )
  );

CREATE POLICY audit_log_insert_platform ON public.audit_log
  FOR INSERT TO authenticated
  WITH CHECK (
    actor_user_id = app_private.current_user_id()
    AND (
      app_private.is_platform_admin()
      OR app_private.is_platform_support()
    )
  );

-- moderation_actions: platform_admin insert only; support cannot write.
CREATE POLICY moderation_actions_select_platform ON public.moderation_actions
  FOR SELECT TO authenticated
  USING (app_private.is_platform_admin() OR app_private.is_platform_support());

CREATE POLICY moderation_actions_select_tenant ON public.moderation_actions
  FOR SELECT TO authenticated
  USING (app_private.is_tenant_of_venue(venue_id));

CREATE POLICY moderation_actions_insert_admin ON public.moderation_actions
  FOR INSERT TO authenticated
  WITH CHECK (
    app_private.is_platform_admin()
    AND platform_user_id = app_private.current_user_id()
    AND length(trim(reason)) > 0
  );
