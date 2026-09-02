-- Staff directory and live presence module. Forward-only.
-- Presence is a public promotional indicator, not attendance or payroll.
-- Writes go through SECURITY DEFINER RPCs in the following migration.
-- The 33 permission actions are unchanged.

-- ---------------------------------------------------------------------------
-- Private business-scoped staff record
-- ---------------------------------------------------------------------------

CREATE TABLE public.staff_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses (id) ON DELETE RESTRICT,
  user_id uuid REFERENCES public.users (id) ON DELETE SET NULL,
  internal_display_name text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  deactivated_at timestamptz,
  deactivated_by uuid REFERENCES public.users (id) ON DELETE RESTRICT,
  restored_at timestamptz,
  restored_by uuid REFERENCES public.users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.users (id) ON DELETE RESTRICT,
  updated_by uuid REFERENCES public.users (id) ON DELETE RESTRICT,
  CONSTRAINT staff_members_id_business_id_key UNIQUE (id, business_id),
  CONSTRAINT staff_members_internal_display_name_check CHECK (
    char_length(btrim(internal_display_name)) BETWEEN 1 AND 120
  ),
  CONSTRAINT staff_members_status_check CHECK (status IN ('active', 'deactivated')),
  CONSTRAINT staff_members_deactivated_consistency_check CHECK (
    (status = 'deactivated' AND deactivated_at IS NOT NULL)
    OR (status = 'active' AND deactivated_at IS NULL)
  )
);

COMMENT ON TABLE public.staff_members IS
  'Business-scoped private staff record. Never exposed on the public site. Not payroll, HR or legal identity.';

COMMENT ON COLUMN public.staff_members.internal_display_name IS
  'Internal reference name only. Not a legal name and not shown publicly.';

COMMENT ON COLUMN public.staff_members.user_id IS
  'Optional linked login. A public profile may exist before the person has a VenuBoard account. The same user may have separate staff records in different businesses.';

CREATE UNIQUE INDEX staff_members_business_user_uidx
  ON public.staff_members (business_id, user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX staff_members_business_status_idx
  ON public.staff_members (business_id, status);

CREATE TRIGGER staff_members_set_updated_at
  BEFORE UPDATE ON public.staff_members
  FOR EACH ROW
  EXECUTE FUNCTION app_private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Venue assignment and public profile
-- ---------------------------------------------------------------------------

CREATE TABLE public.staff_public_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES public.venues (id) ON DELETE RESTRICT,
  business_id uuid NOT NULL,
  staff_member_id uuid NOT NULL,
  public_display_name text NOT NULL,
  public_title text,
  avatar_storage_path text,
  display_order integer NOT NULL DEFAULT 0,
  assignment_status text NOT NULL DEFAULT 'active',
  publication_state text NOT NULL DEFAULT 'draft',
  consent_state text NOT NULL DEFAULT 'pending',
  consent_recorded_at timestamptz,
  consent_recorded_by uuid REFERENCES public.users (id) ON DELETE RESTRICT,
  platform_quarantined_at timestamptz,
  platform_quarantine_reason text,
  platform_quarantined_by uuid REFERENCES public.users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.users (id) ON DELETE RESTRICT,
  updated_by uuid REFERENCES public.users (id) ON DELETE RESTRICT,
  CONSTRAINT staff_public_profiles_id_venue_id_key UNIQUE (id, venue_id),
  CONSTRAINT staff_public_profiles_venue_staff_key UNIQUE (venue_id, staff_member_id),
  CONSTRAINT staff_public_profiles_staff_business_fkey
    FOREIGN KEY (staff_member_id, business_id)
    REFERENCES public.staff_members (id, business_id)
    ON DELETE RESTRICT,
  CONSTRAINT staff_public_profiles_venue_business_fkey
    FOREIGN KEY (venue_id, business_id)
    REFERENCES public.venues (id, business_id)
    ON DELETE RESTRICT,
  CONSTRAINT staff_public_profiles_display_name_check CHECK (
    char_length(btrim(public_display_name)) BETWEEN 1 AND 120
  ),
  CONSTRAINT staff_public_profiles_title_check CHECK (
    public_title IS NULL OR char_length(btrim(public_title)) BETWEEN 1 AND 80
  ),
  CONSTRAINT staff_public_profiles_assignment_status_check CHECK (
    assignment_status IN ('active', 'inactive')
  ),
  CONSTRAINT staff_public_profiles_publication_state_check CHECK (
    publication_state IN ('draft', 'published')
  ),
  CONSTRAINT staff_public_profiles_consent_state_check CHECK (
    consent_state IN ('pending', 'granted', 'withdrawn')
  ),
  CONSTRAINT staff_public_profiles_consent_recorded_check CHECK (
    (consent_state = 'pending' AND consent_recorded_at IS NULL AND consent_recorded_by IS NULL)
    OR (consent_state IN ('granted', 'withdrawn') AND consent_recorded_at IS NOT NULL)
  ),
  CONSTRAINT staff_public_profiles_quarantine_reason_check CHECK (
    (platform_quarantined_at IS NULL AND platform_quarantine_reason IS NULL AND platform_quarantined_by IS NULL)
    OR (
      platform_quarantined_at IS NOT NULL
      AND char_length(btrim(platform_quarantine_reason)) > 0
      AND platform_quarantined_by IS NOT NULL
    )
  ),
  CONSTRAINT staff_public_profiles_quarantine_publication_check CHECK (
    platform_quarantined_at IS NULL OR publication_state <> 'published'
  ),
  CONSTRAINT staff_public_profiles_avatar_path_check CHECK (
    avatar_storage_path IS NULL
    OR (
      avatar_storage_path ~ ('^venues/' || venue_id::text || '/staff_presence/[A-Za-z0-9._-]+$')
      AND avatar_storage_path !~* 'https?://'
      AND position('..' in avatar_storage_path) = 0
    )
  ),
  CONSTRAINT staff_public_profiles_display_order_check CHECK (display_order >= 0)
);

COMMENT ON TABLE public.staff_public_profiles IS
  'Venue-specific public staff profile and assignment. Presence alone never publishes this row. Avatar paths are venue-scoped placeholders; upload is deferred.';

COMMENT ON COLUMN public.staff_public_profiles.consent_state IS
  'Operational consent record (pending/granted/withdrawn). A manager click is not legal proof of valid consent.';

COMMENT ON COLUMN public.staff_public_profiles.avatar_storage_path IS
  'Optional venue-scoped storage reference. Remote URLs are rejected. Rendering untrusted URLs is forbidden.';

CREATE INDEX staff_public_profiles_venue_order_idx
  ON public.staff_public_profiles (venue_id, display_order, public_display_name);

CREATE INDEX staff_public_profiles_staff_member_idx
  ON public.staff_public_profiles (staff_member_id);

CREATE TRIGGER staff_public_profiles_set_updated_at
  BEFORE UPDATE ON public.staff_public_profiles
  FOR EACH ROW
  EXECUTE FUNCTION app_private.set_updated_at();

CREATE TABLE public.staff_public_profile_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_public_profile_id uuid NOT NULL,
  venue_id uuid NOT NULL,
  locale text NOT NULL,
  public_bio text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.users (id) ON DELETE RESTRICT,
  CONSTRAINT staff_public_profile_translations_parent_locale_key
    UNIQUE (staff_public_profile_id, locale),
  CONSTRAINT staff_public_profile_translations_parent_venue_fkey
    FOREIGN KEY (staff_public_profile_id, venue_id)
    REFERENCES public.staff_public_profiles (id, venue_id)
    ON DELETE CASCADE,
  CONSTRAINT staff_public_profile_translations_locale_check CHECK (locale IN ('en', 'th')),
  CONSTRAINT staff_public_profile_translations_bio_check CHECK (
    public_bio IS NULL OR char_length(btrim(public_bio)) BETWEEN 1 AND 400
  )
);

COMMENT ON TABLE public.staff_public_profile_translations IS
  'Entity-specific public bio translations. Locale-keyed JSON and polymorphic translation tables are rejected.';

CREATE INDEX staff_public_profile_translations_venue_locale_idx
  ON public.staff_public_profile_translations (venue_id, locale);

CREATE TRIGGER staff_public_profile_translations_set_updated_at
  BEFORE UPDATE ON public.staff_public_profile_translations
  FOR EACH ROW
  EXECUTE FUNCTION app_private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Presence (public promotional status) and append-only history
-- ---------------------------------------------------------------------------

CREATE TABLE public.current_staff_presence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL,
  staff_public_profile_id uuid NOT NULL,
  state text NOT NULL DEFAULT 'not_present',
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by uuid REFERENCES public.users (id) ON DELETE RESTRICT,
  presence_expires_at timestamptz,
  source text NOT NULL DEFAULT 'manager',
  CONSTRAINT current_staff_presence_id_venue_id_key UNIQUE (id, venue_id),
  CONSTRAINT current_staff_presence_profile_key UNIQUE (staff_public_profile_id),
  CONSTRAINT current_staff_presence_profile_venue_fkey
    FOREIGN KEY (staff_public_profile_id, venue_id)
    REFERENCES public.staff_public_profiles (id, venue_id)
    ON DELETE RESTRICT,
  CONSTRAINT current_staff_presence_state_check CHECK (state IN ('present', 'not_present')),
  CONSTRAINT current_staff_presence_source_check CHECK (source IN ('self', 'manager')),
  CONSTRAINT current_staff_presence_expiry_check CHECK (
    (state = 'not_present' AND presence_expires_at IS NULL)
    OR (state = 'present' AND presence_expires_at IS NOT NULL)
  )
);

COMMENT ON TABLE public.current_staff_presence IS
  'Current promotional presence per venue assignment. Not clock-in, not hours worked. Expired present rows are treated as not_present without a background job.';

CREATE INDEX current_staff_presence_venue_state_idx
  ON public.current_staff_presence (venue_id, state);

CREATE INDEX current_staff_presence_expires_idx
  ON public.current_staff_presence (presence_expires_at)
  WHERE state = 'present';

CREATE TABLE public.staff_presence_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL,
  staff_public_profile_id uuid NOT NULL,
  state text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by uuid REFERENCES public.users (id) ON DELETE RESTRICT,
  presence_expires_at timestamptz,
  source text NOT NULL,
  CONSTRAINT staff_presence_events_profile_venue_fkey
    FOREIGN KEY (staff_public_profile_id, venue_id)
    REFERENCES public.staff_public_profiles (id, venue_id)
    ON DELETE RESTRICT,
  CONSTRAINT staff_presence_events_state_check CHECK (state IN ('present', 'not_present')),
  CONSTRAINT staff_presence_events_source_check CHECK (source IN ('self', 'manager', 'deactivation', 'bulk_reset'))
);

COMMENT ON TABLE public.staff_presence_events IS
  'Append-only presence history for operational audit. Never returned on the public site.';

CREATE INDEX staff_presence_events_profile_changed_idx
  ON public.staff_presence_events (staff_public_profile_id, changed_at DESC);

CREATE INDEX staff_presence_events_venue_changed_idx
  ON public.staff_presence_events (venue_id, changed_at DESC);

CREATE TABLE public.staff_consent_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL,
  staff_public_profile_id uuid NOT NULL,
  consent_state text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid REFERENCES public.users (id) ON DELETE RESTRICT,
  source text NOT NULL,
  CONSTRAINT staff_consent_events_profile_venue_fkey
    FOREIGN KEY (staff_public_profile_id, venue_id)
    REFERENCES public.staff_public_profiles (id, venue_id)
    ON DELETE RESTRICT,
  CONSTRAINT staff_consent_events_state_check CHECK (
    consent_state IN ('pending', 'granted', 'withdrawn')
  ),
  CONSTRAINT staff_consent_events_source_check CHECK (source IN ('self', 'manager', 'restoration'))
);

COMMENT ON TABLE public.staff_consent_events IS
  'Append-only operational consent history. Not legal proof that the recorded actor obtained valid consent.';

CREATE INDEX staff_consent_events_profile_recorded_idx
  ON public.staff_consent_events (staff_public_profile_id, recorded_at DESC);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE FUNCTION app_private.actor_platform_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN app_private.is_platform_admin() THEN 'platform_admin'
    WHEN app_private.is_platform_support() THEN 'platform_support'
    ELSE NULL
  END;
$$;

CREATE FUNCTION app_private.staff_presence_settings_shape_ok(p_settings jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT
    p_settings IS NOT NULL
    AND pg_catalog.jsonb_typeof(p_settings) = 'object'
    AND COALESCE(p_settings->>'display_mode', 'all_published') IN ('present_only', 'all_published')
    AND COALESCE(p_settings->>'carousel_order', 'display_order') IN ('display_order', 'name')
    AND COALESCE((p_settings->>'presence_expiry_hours')::integer, 12) BETWEEN 1 AND 24
    AND COALESCE((p_settings->>'carousel_auto_advance')::boolean, false) IN (true, false)
    AND NOT (p_settings ? 'css')
    AND NOT (p_settings ? 'javascript')
    AND NOT (p_settings ? 'html')
    AND NOT (p_settings ? 'script');
$$;

CREATE FUNCTION app_private.protect_staff_presence_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.module_key = 'staff_presence'
     AND NOT app_private.staff_presence_settings_shape_ok(NEW.settings) THEN
    RAISE EXCEPTION 'invalid staff presence settings'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER venue_module_settings_staff_presence_shape
  BEFORE INSERT OR UPDATE ON public.venue_module_settings
  FOR EACH ROW
  EXECUTE FUNCTION app_private.protect_staff_presence_settings();

CREATE FUNCTION app_private.staff_presence_module_entitled(p_venue_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app_private.module_is_entitled(p_venue_id, 'staff_presence');
$$;

CREATE FUNCTION app_private.staff_presence_module_public(p_venue_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.venue_module_settings s
    WHERE s.venue_id = p_venue_id
      AND s.module_key = 'staff_presence'
      AND s.is_enabled
      AND s.is_publicly_visible
      AND app_private.module_is_entitled(p_venue_id, 'staff_presence')
      AND app_private.venue_is_publicly_visible(p_venue_id)
  );
$$;

CREATE FUNCTION app_private.staff_presence_expiry_hours(p_venue_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT LEAST(
    24,
    GREATEST(
      1,
      COALESCE(
        (
          SELECT (s.settings->>'presence_expiry_hours')::integer
          FROM public.venue_module_settings s
          WHERE s.venue_id = p_venue_id
            AND s.module_key = 'staff_presence'
        ),
        12
      )
    )
  );
$$;

CREATE FUNCTION app_private.effective_presence_state(
  p_state text,
  p_expires_at timestamptz
)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_state = 'present'
     AND p_expires_at IS NOT NULL
     AND p_expires_at > pg_catalog.now()
      THEN 'present'
    ELSE 'not_present'
  END;
$$;

CREATE FUNCTION app_private.staff_profile_is_publicly_eligible(p_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.staff_public_profiles p
    JOIN public.staff_members m
      ON m.id = p.staff_member_id
     AND m.business_id = p.business_id
    WHERE p.id = p_profile_id
      AND m.status = 'active'
      AND p.assignment_status = 'active'
      AND p.publication_state = 'published'
      AND p.consent_state = 'granted'
      AND p.platform_quarantined_at IS NULL
      AND app_private.staff_presence_module_public(p.venue_id)
  );
$$;

CREATE FUNCTION app_private.may_manage_public_staff_profiles(p_venue_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app_private.is_user_active()
    AND p_venue_id IS NOT NULL
    AND app_private.staff_presence_module_entitled(p_venue_id)
    AND app_private.subscription_allows_tenant_writes(p_venue_id)
    AND (
      app_private.has_tenant_action_on_venue('manage_public_staff_profiles', p_venue_id)
      OR app_private.platform_may_write_tenant(
        app_private.venue_business_id(p_venue_id),
        p_venue_id
      )
    );
$$;

CREATE FUNCTION app_private.may_view_private_staff(p_business_id uuid, p_venue_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app_private.is_user_active()
    AND (
      (
        p_venue_id IS NOT NULL
        AND app_private.has_tenant_action_on_venue('view_private_staff_data', p_venue_id)
      )
      OR (
        p_business_id IS NOT NULL
        AND app_private.is_business_owner(p_business_id)
        AND app_private.effective_tenant_grant('business_owner', 'view_private_staff_data')
      )
      OR app_private.platform_may_read_tenant(p_business_id, p_venue_id)
    );
$$;

CREATE FUNCTION app_private.staff_member_linked_user_id(p_staff_member_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT m.user_id FROM public.staff_members m WHERE m.id = p_staff_member_id;
$$;

CREATE FUNCTION app_private.may_manage_own_public_profile(p_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.staff_public_profiles p
    JOIN public.staff_members m
      ON m.id = p.staff_member_id
     AND m.business_id = p.business_id
    WHERE p.id = p_profile_id
      AND m.user_id = app_private.current_user_id()
      AND m.status = 'active'
      AND p.assignment_status = 'active'
      AND app_private.is_tenant_of_venue(p.venue_id)
      AND app_private.staff_presence_module_entitled(p.venue_id)
      AND app_private.subscription_allows_tenant_writes(p.venue_id)
      AND app_private.has_tenant_action_on_venue('manage_own_public_profile', p.venue_id)
  );
$$;

CREATE FUNCTION app_private.may_manage_own_consent(p_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.staff_public_profiles p
    JOIN public.staff_members m
      ON m.id = p.staff_member_id
     AND m.business_id = p.business_id
    WHERE p.id = p_profile_id
      AND m.user_id = app_private.current_user_id()
      AND m.status = 'active'
      AND p.assignment_status = 'active'
      AND app_private.is_tenant_of_venue(p.venue_id)
      AND app_private.staff_presence_module_entitled(p.venue_id)
      AND app_private.subscription_allows_tenant_writes(p.venue_id)
      AND app_private.has_tenant_action_on_venue('manage_own_consent', p.venue_id)
  );
$$;

-- C3: staff may toggle only own presence when active, assigned and consented.
-- C14: non-staff toggle_own_presence requires membership, public profile and consent.
-- The grant helper stays false so has_tenant_action_on_venue('toggle_staff_presence')
-- does not become a blanket staff allow.
CREATE FUNCTION app_private.may_set_staff_presence(p_venue_id uuid, p_profile_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid;
  v_linked uuid;
  v_consent text;
  v_assignment text;
  v_staff_status text;
  v_role text;
BEGIN
  IF NOT app_private.is_user_active() THEN
    RETURN false;
  END IF;

  IF p_venue_id IS NULL OR p_profile_id IS NULL THEN
    RETURN false;
  END IF;

  IF NOT app_private.staff_presence_module_entitled(p_venue_id) THEN
    RETURN false;
  END IF;

  IF NOT app_private.subscription_allows_tenant_writes(p_venue_id) THEN
    RETURN false;
  END IF;

  SELECT
    m.user_id,
    m.status,
    p.consent_state,
    p.assignment_status
  INTO v_linked, v_staff_status, v_consent, v_assignment
  FROM public.staff_public_profiles p
  JOIN public.staff_members m
    ON m.id = p.staff_member_id
   AND m.business_id = p.business_id
  WHERE p.id = p_profile_id
    AND p.venue_id = p_venue_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_staff_status <> 'active' OR v_assignment <> 'active' THEN
    RETURN false;
  END IF;

  -- Platform admin has no toggle_staff_presence cell (C19 does not add it).
  IF app_private.has_tenant_action_on_venue('toggle_staff_presence', p_venue_id) THEN
    RETURN true;
  END IF;

  v_user := app_private.current_user_id();
  IF v_linked IS NULL OR v_linked IS DISTINCT FROM v_user THEN
    RETURN false;
  END IF;

  IF v_consent <> 'granted' THEN
    RETURN false;
  END IF;

  IF NOT app_private.is_tenant_of_venue(p_venue_id) THEN
    RETURN false;
  END IF;

  v_role := app_private.venue_membership_role(p_venue_id);
  IF v_role IS NULL AND NOT app_private.is_business_owner(app_private.venue_business_id(p_venue_id)) THEN
    RETURN false;
  END IF;

  IF app_private.has_tenant_action_on_venue('toggle_own_presence', p_venue_id) THEN
    RETURN true;
  END IF;

  -- C3: staff conditional toggle_staff_presence is own-only, consented, active.
  IF v_role = 'staff' THEN
    RETURN true;
  END IF;

  -- C14: non-staff own presence when membership + public profile + consent exist.
  RETURN true;
END;
$$;

CREATE FUNCTION app_private.protect_staff_public_profile_quarantine()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND (
       NEW.platform_quarantined_at IS DISTINCT FROM OLD.platform_quarantined_at
       OR NEW.platform_quarantine_reason IS DISTINCT FROM OLD.platform_quarantine_reason
       OR NEW.platform_quarantined_by IS DISTINCT FROM OLD.platform_quarantined_by
     )
     AND NOT app_private.has_platform_action('moderate_content') THEN
    RAISE EXCEPTION 'quarantine columns are platform-write-only'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER staff_public_profiles_protect_quarantine
  BEFORE UPDATE ON public.staff_public_profiles
  FOR EACH ROW
  EXECUTE FUNCTION app_private.protect_staff_public_profile_quarantine();

CREATE FUNCTION app_private.write_staff_audit(
  p_action text,
  p_business_id uuid,
  p_venue_id uuid,
  p_target_table text,
  p_target_id uuid,
  p_summary text,
  p_previous jsonb,
  p_resulting jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.audit_log (
    actor_user_id,
    actor_platform_role,
    action,
    scope_type,
    business_id,
    venue_id,
    target_table,
    target_id,
    summary,
    previous_state,
    resulting_state,
    outcome,
    environment,
    metadata
  )
  VALUES (
    app_private.current_user_id(),
    app_private.actor_platform_role(),
    p_action,
    'venue',
    p_business_id,
    p_venue_id,
    p_target_table,
    p_target_id,
    p_summary,
    p_previous,
    p_resulting,
    'success',
    app_private.audit_environment(),
    '{}'::jsonb
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Grants: authenticated SELECT only. Writes are RPC-only. Anon has no table access.
-- ---------------------------------------------------------------------------

REVOKE ALL ON public.staff_members FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.staff_public_profiles FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.staff_public_profile_translations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.current_staff_presence FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.staff_presence_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.staff_consent_events FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.staff_members TO authenticated;
GRANT SELECT ON public.staff_public_profiles TO authenticated;
GRANT SELECT ON public.staff_public_profile_translations TO authenticated;
GRANT SELECT ON public.current_staff_presence TO authenticated;
GRANT SELECT ON public.staff_presence_events TO authenticated;
GRANT SELECT ON public.staff_consent_events TO authenticated;

ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_members FORCE ROW LEVEL SECURITY;
ALTER TABLE public.staff_public_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_public_profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.staff_public_profile_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_public_profile_translations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.current_staff_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.current_staff_presence FORCE ROW LEVEL SECURITY;
ALTER TABLE public.staff_presence_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_presence_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.staff_consent_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_consent_events FORCE ROW LEVEL SECURITY;

CREATE POLICY staff_members_select_private ON public.staff_members
  FOR SELECT TO authenticated
  USING (
    app_private.may_view_private_staff(business_id, NULL)
    OR (
      user_id IS NOT NULL
      AND user_id = app_private.current_user_id()
    )
    OR EXISTS (
      SELECT 1
      FROM public.venues v
      WHERE v.business_id = staff_members.business_id
        AND app_private.may_view_private_staff(staff_members.business_id, v.id)
    )
  );

CREATE POLICY staff_public_profiles_select_member ON public.staff_public_profiles
  FOR SELECT TO authenticated
  USING (
    app_private.is_tenant_of_venue(venue_id)
    OR app_private.platform_may_read_tenant(business_id, venue_id)
    OR app_private.staff_member_linked_user_id(staff_member_id) = app_private.current_user_id()
  );

CREATE POLICY staff_public_profile_translations_select_member
  ON public.staff_public_profile_translations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.staff_public_profiles p
      WHERE p.id = staff_public_profile_id
        AND p.venue_id = staff_public_profile_translations.venue_id
        AND (
          app_private.is_tenant_of_venue(p.venue_id)
          OR app_private.platform_may_read_tenant(p.business_id, p.venue_id)
          OR app_private.staff_member_linked_user_id(p.staff_member_id) = app_private.current_user_id()
        )
    )
  );

CREATE POLICY current_staff_presence_select_member ON public.current_staff_presence
  FOR SELECT TO authenticated
  USING (
    app_private.is_tenant_of_venue(venue_id)
    OR app_private.platform_may_read_tenant(
      app_private.venue_business_id(venue_id),
      venue_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.staff_public_profiles p
      WHERE p.id = staff_public_profile_id
        AND p.venue_id = current_staff_presence.venue_id
        AND app_private.staff_member_linked_user_id(p.staff_member_id) = app_private.current_user_id()
    )
  );

CREATE POLICY staff_presence_events_select_member ON public.staff_presence_events
  FOR SELECT TO authenticated
  USING (
    app_private.has_tenant_action_on_venue('view_audit_log', venue_id)
    OR app_private.has_tenant_action_on_venue('view_private_staff_data', venue_id)
    OR app_private.has_tenant_action_on_venue('manage_public_staff_profiles', venue_id)
    OR app_private.platform_may_read_tenant(
      app_private.venue_business_id(venue_id),
      venue_id
    )
  );

CREATE POLICY staff_consent_events_select_member ON public.staff_consent_events
  FOR SELECT TO authenticated
  USING (
    app_private.has_tenant_action_on_venue('view_private_staff_data', venue_id)
    OR app_private.has_tenant_action_on_venue('manage_public_staff_profiles', venue_id)
    OR app_private.platform_may_read_tenant(
      app_private.venue_business_id(venue_id),
      venue_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.staff_public_profiles p
      WHERE p.id = staff_public_profile_id
        AND p.venue_id = staff_consent_events.venue_id
        AND app_private.staff_member_linked_user_id(p.staff_member_id) = app_private.current_user_id()
    )
  );

REVOKE ALL ON FUNCTION app_private.actor_platform_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.staff_presence_settings_shape_ok(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.protect_staff_presence_settings() FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.staff_presence_module_entitled(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.staff_presence_module_public(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.staff_presence_expiry_hours(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.effective_presence_state(text, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.staff_profile_is_publicly_eligible(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.may_manage_public_staff_profiles(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.may_view_private_staff(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.staff_member_linked_user_id(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.may_manage_own_public_profile(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.may_manage_own_consent(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.may_set_staff_presence(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.protect_staff_public_profile_quarantine() FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.write_staff_audit(text, uuid, uuid, text, uuid, text, jsonb, jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION app_private.actor_platform_role() TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.staff_presence_settings_shape_ok(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.protect_staff_presence_settings() TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.staff_presence_module_entitled(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.staff_presence_module_public(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION app_private.staff_presence_expiry_hours(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.effective_presence_state(text, timestamptz) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION app_private.staff_profile_is_publicly_eligible(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION app_private.may_manage_public_staff_profiles(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.may_view_private_staff(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.staff_member_linked_user_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.may_manage_own_public_profile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.may_manage_own_consent(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.may_set_staff_presence(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.protect_staff_public_profile_quarantine() TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.write_staff_audit(text, uuid, uuid, text, uuid, text, jsonb, jsonb) TO authenticated;
