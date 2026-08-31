-- Foundation security hardening: C1–C19 default-deny, C19 tenant-content
-- writes, GRANT tightening, and invoker triggers that see the Data API role.
-- Forward-only; does not change accepted product ADRs.

-- ---------------------------------------------------------------------------
-- Conditional grants: allow is allow; conditional is deny unless the
-- condition is checkable against data that already exists.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app_private.conditional_tenant_grant_ok(
  p_role_key text,
  p_action_key text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    -- C2: rank/self/scope are enforced on membership writes, so the grant
    -- itself may be effective for venue_manager.
    WHEN p_role_key = 'venue_manager' AND p_action_key = 'assign_roles' THEN true
    -- C13: tenant-visible rows are filtered in the audit_log SELECT policy.
    WHEN p_action_key = 'view_audit_log' THEN true
    -- Every other conditional cell default-denies until its table or setting
    -- exists (C1, C3–C12, C14, C18) or is enforced only via support session
    -- helpers (C10, C11, C19).
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION app_private.effective_tenant_grant(
  p_role_key text,
  p_action_key text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (
      SELECT CASE g.grant_kind
        WHEN 'allow' THEN true
        WHEN 'conditional' THEN app_private.conditional_tenant_grant_ok(p_role_key, p_action_key)
        ELSE false
      END
      FROM public.role_action_grants g
      WHERE g.role_key = p_role_key
        AND g.action_key = p_action_key
    ),
    false
  );
$$;

CREATE OR REPLACE FUNCTION app_private.has_tenant_action_on_venue(
  p_action_key text,
  p_venue_id uuid
)
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
        AND app_private.effective_tenant_grant('business_owner', p_action_key)
      )
      OR app_private.effective_tenant_grant(
        app_private.venue_membership_role(p_venue_id),
        p_action_key
      )
    );
$$;

CREATE OR REPLACE FUNCTION app_private.has_tenant_action_on_business(
  p_action_key text,
  p_business_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app_private.is_business_owner(p_business_id)
    AND app_private.effective_tenant_grant('business_owner', p_action_key);
$$;

-- C2 + C19: who may write a venue membership row.
CREATE OR REPLACE FUNCTION app_private.may_write_venue_membership(
  p_venue_id uuid,
  p_target_user_id uuid,
  p_role text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app_private.is_user_active()
    AND p_venue_id IS NOT NULL
    AND p_target_user_id IS NOT NULL
    AND p_role IN ('venue_manager', 'content_editor', 'booking_manager', 'staff')
    AND (
      app_private.platform_may_write_tenant(
        app_private.venue_business_id(p_venue_id),
        p_venue_id
      )
      OR (
        app_private.is_business_owner(app_private.venue_business_id(p_venue_id))
        AND app_private.effective_tenant_grant('business_owner', 'assign_roles')
      )
      OR (
        app_private.venue_membership_role(p_venue_id) = 'venue_manager'
        AND app_private.effective_tenant_grant('venue_manager', 'assign_roles')
        AND p_target_user_id IS DISTINCT FROM app_private.current_user_id()
      )
    );
$$;

COMMENT ON FUNCTION app_private.may_write_venue_membership(uuid, uuid, text) IS
  'C2: venue managers assign only venue roles at or below venue_manager, never themselves. C19: platform assign_roles requires a support write session.';

-- ---------------------------------------------------------------------------
-- C19: platform_admin may not edit tenant content columns without write session
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app_private.protect_venue_platform_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF CURRENT_USER IN ('anon', 'authenticated')
     AND NOT app_private.is_platform_admin() THEN
    IF NEW.platform_quarantined_at IS DISTINCT FROM OLD.platform_quarantined_at
       OR NEW.platform_quarantine_reason IS DISTINCT FROM OLD.platform_quarantine_reason
       OR NEW.platform_quarantined_by IS DISTINCT FROM OLD.platform_quarantined_by THEN
      RAISE EXCEPTION 'quarantine columns are platform-write-only'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.publication_state IS DISTINCT FROM OLD.publication_state
       AND NEW.publication_state = 'unpublished_by_platform' THEN
      RAISE EXCEPTION 'unpublished_by_platform is a platform-only publication state'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.classification_locked_by_platform IS DISTINCT FROM OLD.classification_locked_by_platform THEN
      RAISE EXCEPTION 'only the platform may lock content classification'
        USING ERRCODE = '42501';
    END IF;

    IF OLD.classification_locked_by_platform
       AND NEW.content_classification IS DISTINCT FROM OLD.content_classification THEN
      RAISE EXCEPTION 'content classification is locked by the platform'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- C19: without a support write session, platform_admin may only touch
  -- platform-record columns (classification lock, operational status).
  IF CURRENT_USER IN ('anon', 'authenticated')
     AND app_private.is_platform_admin()
     AND NOT app_private.platform_may_write_tenant(NEW.business_id, NEW.id) THEN
    IF NEW.name IS DISTINCT FROM OLD.name
       OR NEW.slug IS DISTINCT FROM OLD.slug
       OR NEW.timezone IS DISTINCT FROM OLD.timezone
       OR NEW.default_locale IS DISTINCT FROM OLD.default_locale
       OR NEW.address_line1 IS DISTINCT FROM OLD.address_line1
       OR NEW.address_line2 IS DISTINCT FROM OLD.address_line2
       OR NEW.city IS DISTINCT FROM OLD.city
       OR NEW.province IS DISTINCT FROM OLD.province
       OR NEW.postal_code IS DISTINCT FROM OLD.postal_code
       OR NEW.country IS DISTINCT FROM OLD.country
       OR NEW.latitude IS DISTINCT FROM OLD.latitude
       OR NEW.longitude IS DISTINCT FROM OLD.longitude
       OR NEW.directions_url IS DISTINCT FROM OLD.directions_url
       OR NEW.publication_state IS DISTINCT FROM OLD.publication_state THEN
      RAISE EXCEPTION 'tenant venue profile fields require a support write session (C19)'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.protect_business_tenant_content()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF CURRENT_USER IN ('anon', 'authenticated')
     AND app_private.is_platform_admin()
     AND NOT app_private.platform_may_write_tenant(NEW.id, NULL) THEN
    IF NEW.name IS DISTINCT FROM OLD.name
       OR NEW.legal_name IS DISTINCT FROM OLD.legal_name
       OR NEW.slug IS DISTINCT FROM OLD.slug
       OR NEW.country IS DISTINCT FROM OLD.country
       OR NEW.default_locale IS DISTINCT FROM OLD.default_locale
       OR NEW.contact_email IS DISTINCT FROM OLD.contact_email THEN
      RAISE EXCEPTION 'tenant business profile fields require a support write session (C19)'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS businesses_protect_tenant_content ON public.businesses;
CREATE TRIGGER businesses_protect_tenant_content
  BEFORE UPDATE ON public.businesses
  FOR EACH ROW
  EXECUTE FUNCTION app_private.protect_business_tenant_content();

-- ---------------------------------------------------------------------------
-- Membership / invitation policies (C1, C2, C19)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS venue_memberships_insert ON public.venue_memberships;
DROP POLICY IF EXISTS venue_memberships_update ON public.venue_memberships;

CREATE POLICY venue_memberships_insert ON public.venue_memberships
  FOR INSERT TO authenticated
  WITH CHECK (
    app_private.may_write_venue_membership(venue_id, user_id, role)
  );

CREATE POLICY venue_memberships_update ON public.venue_memberships
  FOR UPDATE TO authenticated
  USING (
    app_private.may_write_venue_membership(venue_id, user_id, role)
  )
  WITH CHECK (
    app_private.may_write_venue_membership(venue_id, user_id, role)
  );

DROP POLICY IF EXISTS invitations_select ON public.invitations;
DROP POLICY IF EXISTS invitations_insert ON public.invitations;
DROP POLICY IF EXISTS invitations_update ON public.invitations;

-- C1: venue_manager invite_users is conditional and default-denied until the
-- owner-enabled setting exists. Business owners still invite. Platform
-- invitations are tenant writes (C19) and need a support write session.
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
    OR app_private.platform_may_write_tenant(business_id, venue_id)
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
      OR app_private.platform_may_write_tenant(business_id, venue_id)
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
    OR app_private.platform_may_write_tenant(business_id, venue_id)
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
    OR app_private.platform_may_write_tenant(business_id, venue_id)
  );

-- ---------------------------------------------------------------------------
-- Execute grants: RLS helpers only. apply_venue_moderation is authenticated.
-- ---------------------------------------------------------------------------

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app_private FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app_private FROM anon, authenticated;

-- Invoker triggers and RLS helpers need EXECUTE as the Data API role.
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app_private TO authenticated;

-- Anonymous public reads only. apply_venue_moderation is not included.
GRANT EXECUTE ON FUNCTION app_private.current_user_id() TO anon;
GRANT EXECUTE ON FUNCTION app_private.jwt_role() TO anon;
GRANT EXECUTE ON FUNCTION app_private.is_user_active() TO anon;
GRANT EXECUTE ON FUNCTION app_private.is_platform_admin() TO anon;
GRANT EXECUTE ON FUNCTION app_private.is_platform_support() TO anon;
GRANT EXECUTE ON FUNCTION app_private.venue_is_publicly_visible(uuid) TO anon;
GRANT EXECUTE ON FUNCTION app_private.module_is_entitled(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION app_private.subscription_allows_public(uuid) TO anon;
GRANT EXECUTE ON FUNCTION app_private.subscription_allows_tenant_writes(uuid) TO anon;
GRANT EXECUTE ON FUNCTION app_private.subscription_state(uuid) TO anon;
GRANT EXECUTE ON FUNCTION app_private.is_tenant_of_venue(uuid) TO anon;
GRANT EXECUTE ON FUNCTION app_private.is_tenant_of_business(uuid) TO anon;
GRANT EXECUTE ON FUNCTION app_private.is_business_owner(uuid) TO anon;
GRANT EXECUTE ON FUNCTION app_private.venue_business_id(uuid) TO anon;
GRANT EXECUTE ON FUNCTION app_private.venue_membership_role(uuid) TO anon;
GRANT EXECUTE ON FUNCTION app_private.has_tenant_action_on_venue(text, uuid) TO anon;
GRANT EXECUTE ON FUNCTION app_private.has_tenant_action_on_business(text, uuid) TO anon;
GRANT EXECUTE ON FUNCTION app_private.has_platform_action(text) TO anon;
GRANT EXECUTE ON FUNCTION app_private.platform_may_read_tenant(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION app_private.platform_may_write_tenant(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION app_private.active_support_session_covers(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION app_private.role_grants_action(text, text) TO anon;
GRANT EXECUTE ON FUNCTION app_private.effective_tenant_grant(text, text) TO anon;
GRANT EXECUTE ON FUNCTION app_private.conditional_tenant_grant_ok(text, text) TO anon;

REVOKE ALL ON FUNCTION app_private.apply_venue_moderation(uuid, text, text, text) FROM anon;
REVOKE ALL ON FUNCTION app_private.apply_venue_moderation(uuid, text, text, text) FROM PUBLIC;

ALTER DEFAULT PRIVILEGES IN SCHEMA app_private
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

COMMENT ON SCHEMA app_private IS
  'Authorisation helpers. Not in the Data API. EXECUTE is granted per function, never PUBLIC.';
