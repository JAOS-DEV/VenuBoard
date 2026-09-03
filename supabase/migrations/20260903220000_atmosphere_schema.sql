-- Live venue atmosphere. Forward-only. No enum types. RLS is
-- authoritative. Public reads go through RPCs, not base-table anon grants.
-- Atmosphere is a subjective promotional indicator, not occupancy or safety.

CREATE FUNCTION app_private.atmosphere_settings_shape_ok(p_settings jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT
    jsonb_typeof(p_settings) = 'object'
    AND COALESCE((p_settings->>'default_expiry_minutes')::integer, 120)
      IN (30, 60, 90, 120, 180, 240, 360)
    AND COALESCE((p_settings->>'front_of_house_may_update')::boolean, false)
      IN (true, false)
    AND COALESCE(p_settings->>'presentation', 'card')
      IN ('card', 'compact', 'badge')
    AND NOT (p_settings ? 'css')
    AND NOT (p_settings ? 'javascript')
    AND NOT (p_settings ? 'html')
    AND NOT (p_settings ? 'script');
$$;

CREATE FUNCTION app_private.protect_atmosphere_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.module_key = 'atmosphere'
     AND NOT app_private.atmosphere_settings_shape_ok(NEW.settings) THEN
    RAISE EXCEPTION 'invalid atmosphere settings'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER venue_module_settings_atmosphere_shape
  BEFORE INSERT OR UPDATE ON public.venue_module_settings
  FOR EACH ROW
  EXECUTE FUNCTION app_private.protect_atmosphere_settings();

CREATE FUNCTION app_private.atmosphere_module_entitled(p_venue_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app_private.module_is_entitled(p_venue_id, 'atmosphere');
$$;

CREATE FUNCTION app_private.atmosphere_front_of_house_may_update(p_venue_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (
      SELECT (s.settings->>'front_of_house_may_update')::boolean
      FROM public.venue_module_settings s
      WHERE s.venue_id = p_venue_id
        AND s.module_key = 'atmosphere'
    ),
    false
  );
$$;

CREATE FUNCTION app_private.atmosphere_module_public(p_venue_id uuid)
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
      AND s.module_key = 'atmosphere'
      AND s.is_enabled
      AND s.is_publicly_visible
      AND app_private.module_is_entitled(p_venue_id, 'atmosphere')
      AND app_private.venue_is_publicly_visible(p_venue_id)
  );
$$;

CREATE FUNCTION app_private.atmosphere_actor_is_front_of_house(p_venue_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.venue_memberships m
    WHERE m.venue_id = p_venue_id
      AND m.user_id = app_private.current_user_id()
      AND m.status = 'active'
      AND m.role IN ('content_editor', 'staff')
  )
  AND app_private.atmosphere_front_of_house_may_update(p_venue_id);
$$;

CREATE FUNCTION app_private.may_read_atmosphere_admin(p_venue_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    app_private.is_user_active()
    AND (
      app_private.has_tenant_action_on_venue('manage_atmosphere', p_venue_id)
      OR app_private.has_tenant_action_on_venue(
        'manage_venue_module_visibility',
        p_venue_id
      )
      OR app_private.atmosphere_actor_is_front_of_house(p_venue_id)
      OR app_private.platform_may_read_tenant(
        (SELECT v.business_id FROM public.venues v WHERE v.id = p_venue_id),
        p_venue_id
      )
    );
$$;

CREATE FUNCTION app_private.may_write_atmosphere(p_venue_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    app_private.is_user_active()
    AND app_private.subscription_allows_tenant_writes(p_venue_id)
    AND app_private.atmosphere_module_entitled(p_venue_id)
    AND EXISTS (
      SELECT 1
      FROM public.venue_module_settings s
      WHERE s.venue_id = p_venue_id
        AND s.module_key = 'atmosphere'
        AND s.is_enabled
    )
    AND (
      app_private.has_tenant_action_on_venue('manage_atmosphere', p_venue_id)
      OR app_private.atmosphere_actor_is_front_of_house(p_venue_id)
      OR app_private.platform_may_write_tenant(
        (SELECT v.business_id FROM public.venues v WHERE v.id = p_venue_id),
        p_venue_id
      )
    );
$$;

CREATE TABLE public.venue_atmosphere (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES public.venues (id) ON DELETE RESTRICT,
  business_id uuid NOT NULL,
  atmosphere_state text NOT NULL,
  set_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  changed_by uuid NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT venue_atmosphere_venue_id_key UNIQUE (venue_id),
  CONSTRAINT venue_atmosphere_venue_business_fkey
    FOREIGN KEY (venue_id, business_id)
    REFERENCES public.venues (id, business_id),
  CONSTRAINT venue_atmosphere_id_venue_id_key UNIQUE (id, venue_id),
  CONSTRAINT venue_atmosphere_state_check CHECK (
    atmosphere_state IN ('calm', 'social', 'lively', 'high_energy')
  ),
  CONSTRAINT venue_atmosphere_expiry_window_check CHECK (
    expires_at >= set_at + interval '30 minutes'
    AND expires_at <= set_at + interval '6 hours'
  )
);

COMMENT ON TABLE public.venue_atmosphere IS
  'One current promotional atmosphere per venue. Expired rows are treated as absent at query time. Not occupancy, capacity, or safety data.';

CREATE INDEX venue_atmosphere_expires_idx
  ON public.venue_atmosphere (venue_id, expires_at);

CREATE TRIGGER venue_atmosphere_set_updated_at
  BEFORE UPDATE ON public.venue_atmosphere
  FOR EACH ROW
  EXECUTE FUNCTION app_private.set_updated_at();

CREATE TABLE public.venue_atmosphere_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES public.venues (id) ON DELETE RESTRICT,
  business_id uuid NOT NULL,
  previous_state text,
  new_state text,
  action text NOT NULL,
  source text NOT NULL DEFAULT 'rpc',
  expiry_minutes integer,
  expires_at timestamptz,
  actor_user_id uuid REFERENCES public.users (id) ON DELETE RESTRICT,
  environment text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT venue_atmosphere_events_venue_business_fkey
    FOREIGN KEY (venue_id, business_id)
    REFERENCES public.venues (id, business_id),
  CONSTRAINT venue_atmosphere_events_action_check CHECK (
    action IN ('set', 'replace', 'clear')
  ),
  CONSTRAINT venue_atmosphere_events_source_check CHECK (source IN ('rpc')),
  CONSTRAINT venue_atmosphere_events_previous_state_check CHECK (
    previous_state IS NULL
    OR previous_state IN ('calm', 'social', 'lively', 'high_energy')
  ),
  CONSTRAINT venue_atmosphere_events_new_state_check CHECK (
    new_state IS NULL
    OR new_state IN ('calm', 'social', 'lively', 'high_energy')
  ),
  CONSTRAINT venue_atmosphere_events_clear_check CHECK (
    (action = 'clear') = (new_state IS NULL)
  ),
  CONSTRAINT venue_atmosphere_events_environment_check CHECK (
    environment IN ('local', 'staging', 'production')
  ),
  CONSTRAINT venue_atmosphere_events_expiry_minutes_check CHECK (
    expiry_minutes IS NULL
    OR expiry_minutes IN (30, 60, 90, 120, 180, 240, 360)
  )
);

COMMENT ON TABLE public.venue_atmosphere_events IS
  'Append-only private atmosphere change history. No public access. No emails or request payloads.';

CREATE INDEX venue_atmosphere_events_venue_changed_idx
  ON public.venue_atmosphere_events (venue_id, changed_at DESC);

CREATE FUNCTION app_private.reject_atmosphere_history_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'atmosphere history is append-only'
    USING ERRCODE = '25006';
END;
$$;

CREATE TRIGGER venue_atmosphere_events_no_update
  BEFORE UPDATE OR DELETE ON public.venue_atmosphere_events
  FOR EACH ROW
  EXECUTE FUNCTION app_private.reject_atmosphere_history_mutation();

CREATE FUNCTION app_private.append_atmosphere_event(
  p_venue_id uuid,
  p_business_id uuid,
  p_previous text,
  p_new text,
  p_action text,
  p_expiry_minutes integer,
  p_expires_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.venue_atmosphere_events (
    venue_id, business_id, previous_state, new_state, action, source,
    expiry_minutes, expires_at, actor_user_id, environment
  )
  VALUES (
    p_venue_id,
    p_business_id,
    p_previous,
    p_new,
    p_action,
    'rpc',
    p_expiry_minutes,
    p_expires_at,
    app_private.current_user_id(),
    app_private.audit_environment()
  );
END;
$$;

CREATE FUNCTION app_private.write_atmosphere_audit(
  p_business_id uuid,
  p_venue_id uuid,
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
    'manage_atmosphere',
    'venue',
    p_business_id,
    p_venue_id,
    'venue_atmosphere',
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

REVOKE ALL ON public.venue_atmosphere FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.venue_atmosphere_events FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.venue_atmosphere TO authenticated;
GRANT SELECT ON public.venue_atmosphere_events TO authenticated;

ALTER TABLE public.venue_atmosphere ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_atmosphere FORCE ROW LEVEL SECURITY;
ALTER TABLE public.venue_atmosphere_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_atmosphere_events FORCE ROW LEVEL SECURITY;

CREATE POLICY venue_atmosphere_select_member ON public.venue_atmosphere
  FOR SELECT TO authenticated
  USING (app_private.may_read_atmosphere_admin(venue_id));

CREATE POLICY venue_atmosphere_events_select_member ON public.venue_atmosphere_events
  FOR SELECT TO authenticated
  USING (app_private.may_read_atmosphere_admin(venue_id));

REVOKE ALL ON FUNCTION app_private.atmosphere_settings_shape_ok(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.protect_atmosphere_settings() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.atmosphere_module_entitled(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.atmosphere_front_of_house_may_update(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.atmosphere_module_public(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.atmosphere_actor_is_front_of_house(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.may_read_atmosphere_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.may_write_atmosphere(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.reject_atmosphere_history_mutation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.append_atmosphere_event(uuid, uuid, text, text, text, integer, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.write_atmosphere_audit(uuid, uuid, uuid, text, jsonb, jsonb) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION app_private.may_read_atmosphere_admin(uuid) TO authenticated;
