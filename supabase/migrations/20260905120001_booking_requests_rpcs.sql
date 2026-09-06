-- Booking enquiry RPCs. Codes only. search_path is empty.
-- Public intake is service_role-only. Anon and authenticated cannot call it.

CREATE FUNCTION app_private.booking_error(p_code text)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT pg_catalog.jsonb_build_object('ok', false, 'code', p_code);
$$;

CREATE FUNCTION app_private.booking_sha256(p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT pg_catalog.encode(
    extensions.digest(pg_catalog.convert_to(p_value, 'UTF8'), 'sha256'),
    'hex'
  );
$$;

CREATE FUNCTION app_private.booking_normalize_email(p_email text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT lower(pg_catalog.btrim(COALESCE(p_email, '')));
$$;

CREATE FUNCTION app_private.booking_payload_hash(p_payload jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT app_private.booking_sha256(
    pg_catalog.concat_ws(
      chr(31),
      lower(pg_catalog.btrim(COALESCE(p_payload->>'display_name', ''))),
      app_private.booking_normalize_email(p_payload->>'email'),
      COALESCE(p_payload->>'party_size', ''),
      COALESCE(p_payload->>'requested_local', ''),
      COALESCE(p_payload->>'locale', ''),
      pg_catalog.btrim(COALESCE(p_payload->>'message', ''))
    )
  );
$$;

CREATE FUNCTION public.submit_booking_enquiry(p_venue_slug text, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_venue public.venues%ROWTYPE;
  v_settings public.venue_module_settings%ROWTYPE;
  v_key text;
  v_key_hash text;
  v_payload_hash text;
  v_existing public.booking_intake_idempotency%ROWTYPE;
  v_name text;
  v_email text;
  v_message text;
  v_locale text;
  v_party integer;
  v_local text;
  v_local_ts timestamp;
  v_requested timestamptz;
  v_roundtrip timestamp;
  v_min_party integer;
  v_max_party integer;
  v_horizon integer;
  v_lead integer;
  v_window timestamptz;
  v_count integer;
  v_id uuid;
BEGIN
  IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN
    RETURN app_private.booking_error('invalid_payload');
  END IF;

  v_key := pg_catalog.btrim(COALESCE(p_payload->>'idempotency_key', ''));
  IF v_key !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    RETURN app_private.booking_error('invalid_payload');
  END IF;

  SELECT * INTO v_venue
  FROM public.venues v
  WHERE v.slug = p_venue_slug;

  IF NOT FOUND THEN
    RETURN app_private.booking_error('unavailable');
  END IF;

  IF v_venue.publication_state IS DISTINCT FROM 'published'
     OR v_venue.platform_quarantined_at IS NOT NULL THEN
    RETURN app_private.booking_error('unavailable');
  END IF;

  IF NOT app_private.booking_public_intake_open(v_venue.id) THEN
    RETURN app_private.booking_error('unavailable');
  END IF;

  SELECT * INTO v_settings
  FROM public.venue_module_settings s
  WHERE s.venue_id = v_venue.id
    AND s.module_key = 'booking_requests';

  v_min_party := COALESCE((v_settings.settings->>'min_party_size')::integer, 1);
  v_max_party := COALESCE((v_settings.settings->>'max_party_size')::integer, 12);
  v_horizon := COALESCE((v_settings.settings->>'horizon_days')::integer, 90);
  v_lead := COALESCE((v_settings.settings->>'lead_time_minutes')::integer, 60);

  v_name := pg_catalog.btrim(COALESCE(p_payload->>'display_name', ''));
  v_email := app_private.booking_normalize_email(p_payload->>'email');
  v_message := NULLIF(pg_catalog.btrim(COALESCE(p_payload->>'message', '')), '');
  v_locale := COALESCE(NULLIF(p_payload->>'locale', ''), 'en');
  v_local := pg_catalog.btrim(COALESCE(p_payload->>'requested_local', ''));

  BEGIN
    v_party := (p_payload->>'party_size')::integer;
  EXCEPTION WHEN OTHERS THEN
    RETURN app_private.booking_error('invalid_payload');
  END;

  IF v_name = ''
     OR char_length(v_name) > 80
     OR v_name ~ '[[:cntrl:]]'
     OR v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
     OR char_length(v_email) > 254
     OR v_locale NOT IN ('en', 'th')
     OR v_party < v_min_party
     OR v_party > v_max_party
     OR v_local !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}$'
     OR (v_message IS NOT NULL AND (
       char_length(v_message) > 500 OR v_message ~ '[[:cntrl:]]'
     )) THEN
    RETURN app_private.booking_error('invalid_payload');
  END IF;

  BEGIN
    v_local_ts := replace(v_local, 'T', ' ')::timestamp;
  EXCEPTION WHEN OTHERS THEN
    RETURN app_private.booking_error('invalid_payload');
  END;

  v_requested := v_local_ts AT TIME ZONE v_venue.timezone;
  v_roundtrip := v_requested AT TIME ZONE v_venue.timezone;
  IF v_roundtrip IS DISTINCT FROM v_local_ts THEN
    RETURN app_private.booking_error('invalid_payload');
  END IF;

  IF v_requested < pg_catalog.now() + pg_catalog.make_interval(mins => v_lead) THEN
    RETURN app_private.booking_error('invalid_payload');
  END IF;

  IF v_requested > pg_catalog.now() + pg_catalog.make_interval(days => v_horizon) THEN
    RETURN app_private.booking_error('invalid_payload');
  END IF;

  v_key_hash := app_private.booking_sha256(v_venue.id::text || ':' || v_key);
  v_payload_hash := app_private.booking_payload_hash(p_payload);

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(v_key_hash));

  SELECT * INTO v_existing
  FROM public.booking_intake_idempotency i
  WHERE i.venue_id = v_venue.id
    AND i.key_hash = v_key_hash;

  IF FOUND THEN
    IF v_existing.expires_at > pg_catalog.now()
       AND v_existing.payload_hash = v_payload_hash THEN
      RETURN pg_catalog.jsonb_build_object('ok', true, 'duplicate', true);
    END IF;
    IF v_existing.expires_at > pg_catalog.now() THEN
      RETURN app_private.booking_error('conflict');
    END IF;
    DELETE FROM public.booking_intake_idempotency i
    WHERE i.id = v_existing.id;
  END IF;

  v_window := pg_catalog.date_trunc('hour', pg_catalog.now());

  INSERT INTO public.booking_intake_windows (
    venue_id, window_start, submission_count
  )
  VALUES (v_venue.id, v_window, 1)
  ON CONFLICT (venue_id, window_start)
  DO UPDATE SET
    submission_count = public.booking_intake_windows.submission_count + 1
  WHERE public.booking_intake_windows.submission_count < 30
  RETURNING submission_count INTO v_count;

  IF v_count IS NULL THEN
    RETURN app_private.booking_error('unavailable');
  END IF;

  INSERT INTO public.booking_requests (
    venue_id,
    business_id,
    locale,
    party_size,
    requested_for,
    state
  )
  VALUES (
    v_venue.id,
    v_venue.business_id,
    v_locale,
    v_party,
    v_requested,
    'new'
  )
  RETURNING id INTO v_id;

  INSERT INTO public.booking_request_contacts (
    booking_request_id,
    venue_id,
    customer_display_name,
    customer_email,
    customer_message
  )
  VALUES (
    v_id,
    v_venue.id,
    v_name,
    v_email,
    v_message
  );

  INSERT INTO public.booking_intake_idempotency (
    venue_id, key_hash, payload_hash, expires_at
  )
  VALUES (
    v_venue.id,
    v_key_hash,
    v_payload_hash,
    pg_catalog.now() + interval '24 hours'
  );

  PERFORM app_private.append_booking_event(
    v_id, v_venue.id, 'created', NULL, 'new', NULL
  );

  RETURN pg_catalog.jsonb_build_object('ok', true);
END;
$$;

CREATE FUNCTION public.review_booking_enquiry(
  p_enquiry_id uuid,
  p_expected_row_version integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.booking_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_row
  FROM public.booking_requests r
  WHERE r.id = p_enquiry_id;

  IF NOT FOUND THEN
    RETURN app_private.booking_error('not_found');
  END IF;

  IF NOT app_private.may_manage_bookings(v_row.venue_id) THEN
    RETURN app_private.booking_error('forbidden');
  END IF;

  IF v_row.row_version IS DISTINCT FROM p_expected_row_version THEN
    RETURN app_private.booking_error('conflict');
  END IF;

  IF v_row.state IS DISTINCT FROM 'new' THEN
    RETURN app_private.booking_error('conflict');
  END IF;

  UPDATE public.booking_requests
  SET
    state = 'in_review',
    reviewed_at = pg_catalog.now(),
    reviewed_by = app_private.current_user_id()
  WHERE id = v_row.id
    AND row_version = p_expected_row_version
    AND state = 'new';

  IF NOT FOUND THEN
    RETURN app_private.booking_error('conflict');
  END IF;

  PERFORM app_private.append_booking_event(
    v_row.id, v_row.venue_id, 'reviewed', 'new', 'in_review', NULL
  );
  PERFORM app_private.write_booking_audit(
    'booking_enquiry_reviewed',
    v_row.business_id,
    v_row.venue_id,
    v_row.id,
    'Enquiry moved to in review',
    pg_catalog.jsonb_build_object('state', 'new'),
    pg_catalog.jsonb_build_object('state', 'in_review')
  );

  RETURN pg_catalog.jsonb_build_object('ok', true);
END;
$$;

CREATE FUNCTION public.close_booking_enquiry(
  p_enquiry_id uuid,
  p_outcome text,
  p_expected_row_version integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.booking_requests%ROWTYPE;
BEGIN
  IF p_outcome NOT IN (
    'handled', 'declined', 'duplicate', 'spam', 'withdrawn'
  ) THEN
    RETURN app_private.booking_error('invalid_payload');
  END IF;

  SELECT * INTO v_row
  FROM public.booking_requests r
  WHERE r.id = p_enquiry_id;

  IF NOT FOUND THEN
    RETURN app_private.booking_error('not_found');
  END IF;

  IF NOT app_private.may_manage_bookings(v_row.venue_id) THEN
    RETURN app_private.booking_error('forbidden');
  END IF;

  IF v_row.row_version IS DISTINCT FROM p_expected_row_version THEN
    RETURN app_private.booking_error('conflict');
  END IF;

  IF v_row.state NOT IN ('new', 'in_review') THEN
    RETURN app_private.booking_error('conflict');
  END IF;

  UPDATE public.booking_requests
  SET
    state = 'closed',
    closure_outcome = p_outcome,
    closed_at = pg_catalog.now(),
    closed_by = app_private.current_user_id()
  WHERE id = v_row.id
    AND row_version = p_expected_row_version
    AND state IN ('new', 'in_review');

  IF NOT FOUND THEN
    RETURN app_private.booking_error('conflict');
  END IF;

  PERFORM app_private.append_booking_event(
    v_row.id,
    v_row.venue_id,
    'closed',
    v_row.state,
    'closed',
    p_outcome
  );
  PERFORM app_private.write_booking_audit(
    'booking_enquiry_closed',
    v_row.business_id,
    v_row.venue_id,
    v_row.id,
    'Enquiry closed',
    pg_catalog.jsonb_build_object('state', v_row.state),
    pg_catalog.jsonb_build_object('state', 'closed', 'outcome', p_outcome)
  );

  RETURN pg_catalog.jsonb_build_object('ok', true);
END;
$$;

CREATE FUNCTION public.reopen_booking_enquiry(
  p_enquiry_id uuid,
  p_expected_row_version integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.booking_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_row
  FROM public.booking_requests r
  WHERE r.id = p_enquiry_id;

  IF NOT FOUND THEN
    RETURN app_private.booking_error('not_found');
  END IF;

  IF NOT app_private.may_manage_bookings(v_row.venue_id) THEN
    RETURN app_private.booking_error('forbidden');
  END IF;

  IF v_row.row_version IS DISTINCT FROM p_expected_row_version THEN
    RETURN app_private.booking_error('conflict');
  END IF;

  IF v_row.state IS DISTINCT FROM 'closed' THEN
    RETURN app_private.booking_error('conflict');
  END IF;

  UPDATE public.booking_requests
  SET
    state = 'in_review',
    closure_outcome = NULL,
    closed_at = NULL,
    closed_by = NULL,
    reviewed_at = pg_catalog.now(),
    reviewed_by = app_private.current_user_id()
  WHERE id = v_row.id
    AND row_version = p_expected_row_version
    AND state = 'closed';

  IF NOT FOUND THEN
    RETURN app_private.booking_error('conflict');
  END IF;

  PERFORM app_private.append_booking_event(
    v_row.id, v_row.venue_id, 'reopened', 'closed', 'in_review', NULL
  );
  PERFORM app_private.write_booking_audit(
    'booking_enquiry_reopened',
    v_row.business_id,
    v_row.venue_id,
    v_row.id,
    'Enquiry reopened',
    pg_catalog.jsonb_build_object('state', 'closed'),
    pg_catalog.jsonb_build_object('state', 'in_review')
  );

  RETURN pg_catalog.jsonb_build_object('ok', true);
END;
$$;

CREATE FUNCTION public.update_booking_module_settings(p_venue_id uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid;
  v_setting_id uuid;
  v_settings jsonb;
  v_enabled boolean;
  v_public boolean;
  v_heading_en text;
  v_heading_th text;
BEGIN
  v_actor := app_private.current_user_id();
  IF v_actor IS NULL THEN
    RETURN app_private.booking_error('unauthenticated');
  END IF;

  IF NOT app_private.may_configure_booking_module(p_venue_id) THEN
    RETURN app_private.booking_error('forbidden');
  END IF;

  v_settings := pg_catalog.jsonb_build_object(
    'accepting_enquiries',
    COALESCE((p_payload->>'accepting_enquiries')::boolean, true),
    'min_party_size',
    COALESCE((p_payload->>'min_party_size')::integer, 1),
    'max_party_size',
    COALESCE((p_payload->>'max_party_size')::integer, 12),
    'horizon_days',
    COALESCE((p_payload->>'horizon_days')::integer, 90),
    'lead_time_minutes',
    COALESCE((p_payload->>'lead_time_minutes')::integer, 60),
    'instructions_en',
    COALESCE(p_payload->>'instructions_en', ''),
    'instructions_th',
    COALESCE(p_payload->>'instructions_th', '')
  );

  IF NOT app_private.booking_settings_shape_ok(v_settings) THEN
    RETURN app_private.booking_error('invalid_payload');
  END IF;

  v_enabled := COALESCE((p_payload->>'is_enabled')::boolean, true);
  v_public := COALESCE((p_payload->>'is_publicly_visible')::boolean, true);
  v_heading_en := NULLIF(pg_catalog.btrim(COALESCE(p_payload->>'heading_en', '')), '');
  v_heading_th := NULLIF(pg_catalog.btrim(COALESCE(p_payload->>'heading_th', '')), '');

  INSERT INTO public.venue_module_settings (
    venue_id, module_key, is_enabled, is_publicly_visible, settings, updated_by
  )
  VALUES (
    p_venue_id, 'booking_requests', v_enabled, v_public, v_settings, v_actor
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

REVOKE ALL ON FUNCTION app_private.booking_error(text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION app_private.booking_sha256(text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION app_private.booking_normalize_email(text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION app_private.booking_payload_hash(jsonb)
  FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.submit_booking_enquiry(text, jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.review_booking_enquiry(uuid, integer)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.close_booking_enquiry(uuid, text, integer)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reopen_booking_enquiry(uuid, integer)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_booking_module_settings(uuid, jsonb)
  FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.submit_booking_enquiry(text, jsonb)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.review_booking_enquiry(uuid, integer)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_booking_enquiry(uuid, text, integer)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.reopen_booking_enquiry(uuid, integer)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_booking_module_settings(uuid, jsonb)
  TO authenticated;
