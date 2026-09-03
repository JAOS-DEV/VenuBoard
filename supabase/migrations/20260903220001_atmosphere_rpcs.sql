-- Atmosphere write and public-read RPCs. Codes only. search_path is empty.

CREATE FUNCTION app_private.atmosphere_error(p_code text)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT pg_catalog.jsonb_build_object('ok', false, 'code', p_code);
$$;

CREATE FUNCTION app_private.atmosphere_expiry_minutes_ok(p_minutes integer)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT p_minutes IN (30, 60, 90, 120, 180, 240, 360);
$$;

CREATE FUNCTION public.set_venue_atmosphere(
  p_venue_id uuid,
  p_state text,
  p_expiry_minutes integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := app_private.current_user_id();
  v_venue public.venues%ROWTYPE;
  v_existing public.venue_atmosphere%ROWTYPE;
  v_id uuid;
  v_action text;
  v_set_at timestamptz := pg_catalog.now();
  v_expires timestamptz;
BEGIN
  IF v_actor IS NULL THEN
    RETURN app_private.atmosphere_error('unauthenticated');
  END IF;
  IF p_venue_id IS NULL
     OR p_state IS NULL
     OR p_state NOT IN ('calm', 'social', 'lively', 'high_energy')
     OR NOT app_private.atmosphere_expiry_minutes_ok(p_expiry_minutes) THEN
    RETURN app_private.atmosphere_error('invalid_payload');
  END IF;
  IF NOT app_private.may_write_atmosphere(p_venue_id) THEN
    RETURN app_private.atmosphere_error('forbidden');
  END IF;

  SELECT * INTO v_venue FROM public.venues v WHERE v.id = p_venue_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN app_private.atmosphere_error('not_found');
  END IF;

  v_expires := v_set_at + (p_expiry_minutes || ' minutes')::interval;

  SELECT * INTO v_existing
  FROM public.venue_atmosphere a
  WHERE a.venue_id = p_venue_id
  FOR UPDATE;

  IF FOUND THEN
    v_action := 'replace';
    v_id := v_existing.id;
    UPDATE public.venue_atmosphere a
    SET
      atmosphere_state = p_state,
      set_at = v_set_at,
      expires_at = v_expires,
      changed_by = v_actor
    WHERE a.venue_id = p_venue_id;
  ELSE
    v_action := 'set';
    v_id := pg_catalog.gen_random_uuid();
    INSERT INTO public.venue_atmosphere (
      id, venue_id, business_id, atmosphere_state, set_at, expires_at, changed_by
    )
    VALUES (
      v_id, p_venue_id, v_venue.business_id, p_state, v_set_at, v_expires, v_actor
    );
  END IF;

  PERFORM app_private.append_atmosphere_event(
    p_venue_id,
    v_venue.business_id,
    v_existing.atmosphere_state,
    p_state,
    v_action,
    p_expiry_minutes,
    v_expires
  );
  PERFORM app_private.write_atmosphere_audit(
    v_venue.business_id,
    p_venue_id,
    v_id,
    v_action,
    CASE
      WHEN v_existing.atmosphere_state IS NULL THEN NULL
      ELSE pg_catalog.jsonb_build_object(
        'state', v_existing.atmosphere_state,
        'expiry_minutes', NULL
      )
    END,
    pg_catalog.jsonb_build_object(
      'state', p_state,
      'expiry_minutes', p_expiry_minutes
    )
  );

  RETURN pg_catalog.jsonb_build_object('ok', true);
END;
$$;

CREATE FUNCTION public.clear_venue_atmosphere(p_venue_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := app_private.current_user_id();
  v_venue public.venues%ROWTYPE;
  v_existing public.venue_atmosphere%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RETURN app_private.atmosphere_error('unauthenticated');
  END IF;
  IF p_venue_id IS NULL THEN
    RETURN app_private.atmosphere_error('invalid_payload');
  END IF;
  IF NOT app_private.may_write_atmosphere(p_venue_id) THEN
    RETURN app_private.atmosphere_error('forbidden');
  END IF;

  SELECT * INTO v_venue FROM public.venues v WHERE v.id = p_venue_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN app_private.atmosphere_error('not_found');
  END IF;

  SELECT * INTO v_existing
  FROM public.venue_atmosphere a
  WHERE a.venue_id = p_venue_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('ok', true);
  END IF;

  DELETE FROM public.venue_atmosphere a WHERE a.venue_id = p_venue_id;

  PERFORM app_private.append_atmosphere_event(
    p_venue_id,
    v_venue.business_id,
    v_existing.atmosphere_state,
    NULL,
    'clear',
    NULL,
    NULL
  );
  PERFORM app_private.write_atmosphere_audit(
    v_venue.business_id,
    p_venue_id,
    v_existing.id,
    'clear',
    pg_catalog.jsonb_build_object('state', v_existing.atmosphere_state),
    pg_catalog.jsonb_build_object('state', NULL)
  );

  RETURN pg_catalog.jsonb_build_object('ok', true);
END;
$$;

CREATE FUNCTION public.update_atmosphere_module_settings(
  p_venue_id uuid,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := app_private.current_user_id();
  v_settings jsonb;
  v_heading_en text;
  v_heading_th text;
  v_setting_id uuid;
  v_enabled boolean;
  v_public boolean;
BEGIN
  IF v_actor IS NULL THEN
    RETURN app_private.atmosphere_error('unauthenticated');
  END IF;
  IF p_venue_id IS NULL OR p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RETURN app_private.atmosphere_error('invalid_payload');
  END IF;
  IF NOT app_private.has_tenant_action_on_venue(
       'manage_venue_module_visibility', p_venue_id
     )
     AND NOT app_private.platform_may_write_tenant(
       (SELECT v.business_id FROM public.venues v WHERE v.id = p_venue_id),
       p_venue_id
     ) THEN
    RETURN app_private.atmosphere_error('forbidden');
  END IF;
  IF NOT app_private.subscription_allows_tenant_writes(p_venue_id) THEN
    RETURN app_private.atmosphere_error('forbidden');
  END IF;
  IF NOT app_private.atmosphere_module_entitled(p_venue_id) THEN
    RETURN app_private.atmosphere_error('forbidden');
  END IF;

  v_settings := COALESCE(p_payload->'settings', '{}'::jsonb);
  IF NOT app_private.atmosphere_settings_shape_ok(v_settings) THEN
    RETURN app_private.atmosphere_error('invalid_payload');
  END IF;

  v_enabled := COALESCE((p_payload->>'is_enabled')::boolean, true);
  v_public := COALESCE((p_payload->>'is_publicly_visible')::boolean, true);
  v_heading_en := NULLIF(pg_catalog.btrim(COALESCE(p_payload->>'heading_en', '')), '');
  v_heading_th := NULLIF(pg_catalog.btrim(COALESCE(p_payload->>'heading_th', '')), '');

  INSERT INTO public.venue_module_settings (
    venue_id, module_key, is_enabled, is_publicly_visible, settings, updated_by
  )
  VALUES (
    p_venue_id, 'atmosphere', v_enabled, v_public, v_settings, v_actor
  )
  ON CONFLICT (venue_id, module_key)
  DO UPDATE SET
    is_enabled = EXCLUDED.is_enabled,
    is_publicly_visible = EXCLUDED.is_publicly_visible,
    settings = EXCLUDED.settings,
    updated_by = EXCLUDED.updated_by,
    updated_at = pg_catalog.now()
  RETURNING id INTO v_setting_id;

  IF v_heading_en IS NOT NULL THEN
    INSERT INTO public.venue_module_setting_translations (
      venue_module_setting_id, venue_id, locale, public_heading, updated_by
    )
    VALUES (v_setting_id, p_venue_id, 'en', v_heading_en, v_actor)
    ON CONFLICT (venue_module_setting_id, locale)
    DO UPDATE SET
      public_heading = EXCLUDED.public_heading,
      updated_by = EXCLUDED.updated_by,
      updated_at = pg_catalog.now();
  END IF;

  IF v_heading_th IS NOT NULL THEN
    INSERT INTO public.venue_module_setting_translations (
      venue_module_setting_id, venue_id, locale, public_heading, updated_by
    )
    VALUES (v_setting_id, p_venue_id, 'th', v_heading_th, v_actor)
    ON CONFLICT (venue_module_setting_id, locale)
    DO UPDATE SET
      public_heading = EXCLUDED.public_heading,
      updated_by = EXCLUDED.updated_by,
      updated_at = pg_catalog.now();
  END IF;

  RETURN pg_catalog.jsonb_build_object('ok', true);
END;
$$;

CREATE FUNCTION public.get_public_venue_atmosphere(
  p_venue_slug text,
  p_locale text DEFAULT 'en'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_venue public.venues%ROWTYPE;
  v_locale text := CASE WHEN p_locale = 'th' THEN 'th' ELSE 'en' END;
  v_heading text;
  v_state text;
  v_presentation text := 'card';
BEGIN
  IF p_venue_slug IS NULL OR pg_catalog.btrim(p_venue_slug) = '' THEN
    RETURN pg_catalog.jsonb_build_object('ok', true, 'available', false);
  END IF;

  SELECT * INTO v_venue
  FROM public.venues v
  WHERE v.slug = p_venue_slug;

  IF NOT FOUND OR NOT app_private.atmosphere_module_public(v_venue.id) THEN
    RETURN pg_catalog.jsonb_build_object('ok', true, 'available', false);
  END IF;

  SELECT a.atmosphere_state INTO v_state
  FROM public.venue_atmosphere a
  WHERE a.venue_id = v_venue.id
    AND a.expires_at > pg_catalog.now();

  IF v_state IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('ok', true, 'available', false);
  END IF;

  SELECT COALESCE(s.settings->>'presentation', 'card') INTO v_presentation
  FROM public.venue_module_settings s
  WHERE s.venue_id = v_venue.id AND s.module_key = 'atmosphere';

  SELECT t.public_heading INTO v_heading
  FROM public.venue_module_setting_translations t
  JOIN public.venue_module_settings s
    ON s.id = t.venue_module_setting_id AND s.venue_id = t.venue_id
  WHERE s.venue_id = v_venue.id
    AND s.module_key = 'atmosphere'
    AND t.locale = v_locale;

  IF v_heading IS NULL THEN
    SELECT t.public_heading INTO v_heading
    FROM public.venue_module_setting_translations t
    JOIN public.venue_module_settings s
      ON s.id = t.venue_module_setting_id AND s.venue_id = t.venue_id
    WHERE s.venue_id = v_venue.id
      AND s.module_key = 'atmosphere'
      AND t.locale = 'en';
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'ok', true,
    'available', true,
    'heading', v_heading,
    'status_key', v_state,
    'presentation', COALESCE(v_presentation, 'card'),
    'freshness', 'current'
  );
END;
$$;

REVOKE ALL ON FUNCTION app_private.atmosphere_error(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.atmosphere_expiry_minutes_ok(integer) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.set_venue_atmosphere(uuid, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.clear_venue_atmosphere(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_atmosphere_module_settings(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_venue_atmosphere(text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.set_venue_atmosphere(uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_venue_atmosphere(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_atmosphere_module_settings(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_venue_atmosphere(text, text) TO anon, authenticated;
