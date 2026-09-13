-- Venue profile write and public-read RPCs. Codes only. search_path is empty.
-- Definers authorize with manage_venue / manage_branding and never write
-- platform-only columns (classification, slug, timezone, quarantine).

CREATE FUNCTION app_private.venue_profile_error(p_code text)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT pg_catalog.jsonb_build_object('ok', false, 'code', p_code);
$$;

CREATE FUNCTION app_private.venue_profile_parse_time(p_value text)
RETURNS time
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
BEGIN
  IF p_value IS NULL OR p_value !~ '^[0-9]{2}:[0-9]{2}(:[0-9]{2})?$' THEN
    RETURN NULL;
  END IF;
  RETURN p_value::time;
EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
  RETURN NULL;
END;
$$;

CREATE FUNCTION app_private.venue_contact_value_ok(p_type text, p_value text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  v_value text := NULLIF(pg_catalog.btrim(COALESCE(p_value, '')), '');
BEGIN
  IF v_value IS NULL THEN
    RETURN false;
  END IF;
  IF v_value ~ '[[:cntrl:]]' THEN
    RETURN false;
  END IF;
  IF p_type = 'email' THEN
    RETURN char_length(v_value) BETWEEN 3 AND 254
      AND v_value ~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$';
  END IF;
  IF p_type = 'phone' THEN
    RETURN v_value ~ '^\+?[0-9][0-9[:space:]\-]{6,22}[0-9]$';
  END IF;
  IF p_type = 'website' THEN
    IF v_value !~* '^https://[A-Z0-9][A-Z0-9.\-]*\.[A-Z]{2,}'
       AND v_value !~* '^http://[A-Z0-9][A-Z0-9.\-]*\.[A-Z]{2,}' THEN
      RETURN false;
    END IF;
    IF v_value ~* '^(javascript|data|file|vbscript):' THEN
      RETURN false;
    END IF;
    IF v_value ~* '@' THEN
      RETURN false;
    END IF;
    RETURN char_length(v_value) BETWEEN 10 AND 200;
  END IF;
  RETURN false;
END;
$$;

CREATE FUNCTION app_private.venue_profile_ready(p_venue_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT
    char_length(pg_catalog.btrim(v.name)) BETWEEN 1 AND 80
    AND EXISTS (
      SELECT 1
      FROM public.venue_translations t
      WHERE t.venue_id = p_venue_id
        AND t.locale = 'en'
        AND (
          NULLIF(pg_catalog.btrim(COALESCE(t.tagline, '')), '') IS NOT NULL
          OR NULLIF(pg_catalog.btrim(COALESCE(t.description, '')), '') IS NOT NULL
        )
    )
  FROM public.venues v
  WHERE v.id = p_venue_id;
$$;

CREATE FUNCTION app_private.replace_venue_hours(
  p_venue_id uuid,
  p_actor uuid,
  p_payload jsonb
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_mode text;
  v_week jsonb;
  v_exceptions jsonb;
  v_day jsonb;
  v_dow smallint;
  v_seen boolean[] := ARRAY[false, false, false, false, false, false, false];
  v_intervals jsonb;
  v_interval jsonb;
  v_sort smallint;
  v_opens time;
  v_closes time;
  v_next boolean;
  v_ranges int4range[] := ARRAY[]::int4range[];
  v_range int4range;
  v_exc jsonb;
  v_date date;
  v_exc_id uuid;
  v_closed boolean;
  v_note text;
  v_exc_count integer := 0;
BEGIN
  v_mode := p_payload->>'mode';
  IF v_mode IS NULL OR v_mode NOT IN ('unknown', 'scheduled') THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.venue_opening_hours WHERE venue_id = p_venue_id;
  DELETE FROM public.venue_closed_weekdays WHERE venue_id = p_venue_id;
  DELETE FROM public.venue_hours_exceptions WHERE venue_id = p_venue_id;

  IF v_mode = 'unknown' THEN
    UPDATE public.venues
    SET opening_hours_mode = 'unknown'
    WHERE id = p_venue_id;
    RETURN NULL;
  END IF;

  v_week := p_payload->'week';
  IF jsonb_typeof(v_week) <> 'array' OR jsonb_array_length(v_week) <> 7 THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = '22023';
  END IF;

  FOR v_day IN SELECT jsonb_array_elements(v_week)
  LOOP
    BEGIN
      v_dow := (v_day->>'day')::smallint;
    EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
      RAISE EXCEPTION 'invalid_payload' USING ERRCODE = '22023';
    END;
    IF v_dow < 1 OR v_dow > 7 OR v_seen[v_dow] THEN
      RAISE EXCEPTION 'invalid_payload' USING ERRCODE = '22023';
    END IF;
    v_seen[v_dow] := true;

    IF COALESCE((v_day->>'closed')::boolean, false) THEN
      IF v_day ? 'intervals' AND jsonb_typeof(v_day->'intervals') = 'array'
         AND jsonb_array_length(v_day->'intervals') > 0 THEN
        RAISE EXCEPTION 'invalid_payload' USING ERRCODE = '22023';
      END IF;
      INSERT INTO public.venue_closed_weekdays (venue_id, day_of_week)
      VALUES (p_venue_id, v_dow);
    ELSE
      v_intervals := v_day->'intervals';
      IF jsonb_typeof(v_intervals) <> 'array'
         OR jsonb_array_length(v_intervals) < 1
         OR jsonb_array_length(v_intervals) > 4 THEN
        RAISE EXCEPTION 'invalid_payload' USING ERRCODE = '22023';
      END IF;
      v_sort := 0;
      FOR v_interval IN SELECT jsonb_array_elements(v_intervals)
      LOOP
        v_sort := v_sort + 1;
        v_opens := app_private.venue_profile_parse_time(v_interval->>'opens');
        v_closes := app_private.venue_profile_parse_time(v_interval->>'closes');
        v_next := COALESCE((v_interval->>'closes_next_day')::boolean, false);
        v_range := app_private.venue_hours_interval_range(
          v_dow, v_opens, v_closes, v_next
        );
        IF v_range IS NULL THEN
          RAISE EXCEPTION 'invalid_payload' USING ERRCODE = '22023';
        END IF;
        v_ranges := v_ranges || v_range;
        INSERT INTO public.venue_opening_hours (
          venue_id, day_of_week, sort_order, opens_local, closes_local,
          closes_next_day
        ) VALUES (
          p_venue_id, v_dow, v_sort, v_opens, v_closes, v_next
        );
      END LOOP;
    END IF;
  END LOOP;

  IF app_private.venue_hours_ranges_conflict(v_ranges) THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = '22023';
  END IF;

  v_exceptions := COALESCE(p_payload->'exceptions', '[]'::jsonb);
  IF jsonb_typeof(v_exceptions) <> 'array'
     OR jsonb_array_length(v_exceptions) > 90 THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = '22023';
  END IF;

  FOR v_exc IN SELECT jsonb_array_elements(v_exceptions)
  LOOP
    v_exc_count := v_exc_count + 1;
    BEGIN
      v_date := (v_exc->>'date')::date;
    EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
      RAISE EXCEPTION 'invalid_payload' USING ERRCODE = '22023';
    END;
    v_closed := COALESCE((v_exc->>'closed')::boolean, false);
    v_note := NULLIF(pg_catalog.btrim(COALESCE(v_exc->>'internal_note', '')), '');
    v_exc_id := pg_catalog.gen_random_uuid();
    INSERT INTO public.venue_hours_exceptions (
      id, venue_id, exception_date, is_closed, internal_note, updated_by
    ) VALUES (
      v_exc_id, p_venue_id, v_date, v_closed, v_note, p_actor
    );

    v_intervals := COALESCE(v_exc->'intervals', '[]'::jsonb);
    IF v_closed THEN
      IF jsonb_typeof(v_intervals) = 'array'
         AND jsonb_array_length(v_intervals) > 0 THEN
        RAISE EXCEPTION 'invalid_payload' USING ERRCODE = '22023';
      END IF;
    ELSE
      IF jsonb_typeof(v_intervals) <> 'array'
         OR jsonb_array_length(v_intervals) < 1
         OR jsonb_array_length(v_intervals) > 4 THEN
        RAISE EXCEPTION 'invalid_payload' USING ERRCODE = '22023';
      END IF;
      v_sort := 0;
      v_ranges := ARRAY[]::int4range[];
      FOR v_interval IN SELECT jsonb_array_elements(v_intervals)
      LOOP
        v_sort := v_sort + 1;
        v_opens := app_private.venue_profile_parse_time(v_interval->>'opens');
        v_closes := app_private.venue_profile_parse_time(v_interval->>'closes');
        v_next := COALESCE((v_interval->>'closes_next_day')::boolean, false);
        v_range := app_private.venue_hours_interval_range(
          1::smallint, v_opens, v_closes, v_next
        );
        IF v_range IS NULL THEN
          RAISE EXCEPTION 'invalid_payload' USING ERRCODE = '22023';
        END IF;
        v_ranges := v_ranges || v_range;
        INSERT INTO public.venue_hours_exception_intervals (
          exception_id, venue_id, sort_order, opens_local, closes_local,
          closes_next_day
        ) VALUES (
          v_exc_id, p_venue_id, v_sort, v_opens, v_closes, v_next
        );
      END LOOP;
      IF app_private.venue_hours_ranges_conflict(v_ranges) THEN
        RAISE EXCEPTION 'invalid_payload' USING ERRCODE = '22023';
      END IF;
    END IF;
  END LOOP;

  UPDATE public.venues
  SET opening_hours_mode = 'scheduled'
  WHERE id = p_venue_id;
  RETURN NULL;
EXCEPTION
  WHEN unique_violation OR check_violation OR exclusion_violation THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = '22023';
END;
$$;

CREATE FUNCTION public.save_venue_public_profile(p_venue_id uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := app_private.current_user_id();
  v_venue public.venues%ROWTYPE;
  v_expected timestamptz;
  v_name text;
  v_lat double precision;
  v_lng double precision;
  v_contacts jsonb;
  v_contact jsonb;
  v_type text;
  v_value text;
  v_types text[] := ARRAY[]::text[];
BEGIN
  IF v_actor IS NULL THEN
    RETURN app_private.venue_profile_error('unauthenticated');
  END IF;
  IF p_venue_id IS NULL OR p_payload IS NULL
     OR jsonb_typeof(p_payload) <> 'object' THEN
    RETURN app_private.venue_profile_error('invalid_payload');
  END IF;
  IF NOT app_private.may_manage_venue_profile(p_venue_id) THEN
    RETURN app_private.venue_profile_error('forbidden');
  END IF;

  SELECT * INTO v_venue FROM public.venues v WHERE v.id = p_venue_id;
  IF NOT FOUND THEN
    RETURN app_private.venue_profile_error('not_found');
  END IF;

  BEGIN
    v_expected := (p_payload->>'expected_updated_at')::timestamptz;
  EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
    RETURN app_private.venue_profile_error('invalid_payload');
  END;
  IF v_expected IS NULL OR v_venue.updated_at IS DISTINCT FROM v_expected THEN
    RETURN app_private.venue_profile_error('conflict');
  END IF;

  v_name := NULLIF(pg_catalog.btrim(COALESCE(p_payload->>'name', '')), '');
  IF v_name IS NULL OR char_length(v_name) > 80 THEN
    RETURN app_private.venue_profile_error('invalid_payload');
  END IF;

  IF (p_payload ? 'latitude') <> (p_payload ? 'longitude') THEN
    RETURN app_private.venue_profile_error('invalid_payload');
  END IF;
  IF p_payload->>'latitude' IS NULL OR p_payload->>'latitude' = '' THEN
    v_lat := NULL;
    v_lng := NULL;
  ELSE
    BEGIN
      v_lat := (p_payload->>'latitude')::double precision;
      v_lng := (p_payload->>'longitude')::double precision;
    EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
      RETURN app_private.venue_profile_error('invalid_payload');
    END;
    IF v_lat < -90 OR v_lat > 90 OR v_lng < -180 OR v_lng > 180 THEN
      RETURN app_private.venue_profile_error('invalid_payload');
    END IF;
  END IF;

  v_contacts := COALESCE(p_payload->'contacts', '[]'::jsonb);
  IF jsonb_typeof(v_contacts) <> 'array' THEN
    RETURN app_private.venue_profile_error('invalid_payload');
  END IF;
  FOR v_contact IN SELECT jsonb_array_elements(v_contacts)
  LOOP
    v_type := v_contact->>'type';
    v_value := NULLIF(pg_catalog.btrim(COALESCE(v_contact->>'value', '')), '');
    IF v_value IS NULL THEN
      CONTINUE;
    END IF;
    IF v_type IS NULL OR v_type = ANY (v_types)
       OR NOT app_private.venue_contact_value_ok(v_type, v_value) THEN
      RETURN app_private.venue_profile_error('invalid_payload');
    END IF;
    v_types := v_types || v_type;
  END LOOP;

  UPDATE public.venues
  SET
    name = v_name,
    address_line1 = NULLIF(pg_catalog.btrim(COALESCE(p_payload->>'address_line1', '')), ''),
    address_line2 = NULLIF(pg_catalog.btrim(COALESCE(p_payload->>'address_line2', '')), ''),
    city = NULLIF(pg_catalog.btrim(COALESCE(p_payload->>'city', '')), ''),
    province = NULLIF(pg_catalog.btrim(COALESCE(p_payload->>'province', '')), ''),
    postal_code = NULLIF(pg_catalog.btrim(COALESCE(p_payload->>'postal_code', '')), ''),
    country = COALESCE(NULLIF(pg_catalog.btrim(COALESCE(p_payload->>'country', '')), ''), country),
    latitude = v_lat,
    longitude = v_lng,
    directions_url = NULL
  WHERE id = p_venue_id;

  PERFORM app_private.upsert_venue_profile_translation(
    p_venue_id, 'en',
    p_payload->>'name_en',
    p_payload->>'tagline_en',
    p_payload->>'description_en',
    p_payload->>'directions_en',
    v_actor
  );
  PERFORM app_private.upsert_venue_profile_translation(
    p_venue_id, 'th',
    p_payload->>'name_th',
    p_payload->>'tagline_th',
    p_payload->>'description_th',
    p_payload->>'directions_th',
    v_actor
  );

  DELETE FROM public.venue_contacts WHERE venue_id = p_venue_id;
  v_types := ARRAY[]::text[];
  FOR v_contact IN SELECT jsonb_array_elements(v_contacts)
  LOOP
    v_type := v_contact->>'type';
    v_value := NULLIF(pg_catalog.btrim(COALESCE(v_contact->>'value', '')), '');
    IF v_value IS NULL THEN
      CONTINUE;
    END IF;
    v_types := v_types || v_type;
    INSERT INTO public.venue_contacts (
      venue_id, contact_type, value, is_public, sort_order, updated_by
    ) VALUES (
      p_venue_id, v_type, v_value, true, COALESCE(array_length(v_types, 1), 1), v_actor
    );
  END LOOP;

  PERFORM app_private.write_venue_profile_audit(
    'manage_venue',
    v_venue.business_id,
    p_venue_id,
    'Updated public venue profile',
    pg_catalog.jsonb_build_object('publication_state', v_venue.publication_state),
    pg_catalog.jsonb_build_object('publication_state', v_venue.publication_state),
    ARRAY['name', 'translations', 'address', 'contacts']
  );

  SELECT updated_at INTO v_expected FROM public.venues WHERE id = p_venue_id;
  RETURN pg_catalog.jsonb_build_object(
    'ok', true,
    'updated_at', v_expected
  );
END;
$$;

CREATE FUNCTION app_private.upsert_venue_profile_translation(
  p_venue_id uuid,
  p_locale text,
  p_name text,
  p_tagline text,
  p_description text,
  p_directions text,
  p_actor uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_name text := NULLIF(pg_catalog.btrim(COALESCE(p_name, '')), '');
  v_tagline text := NULLIF(pg_catalog.btrim(COALESCE(p_tagline, '')), '');
  v_description text := NULLIF(pg_catalog.btrim(COALESCE(p_description, '')), '');
  v_directions text := NULLIF(pg_catalog.btrim(COALESCE(p_directions, '')), '');
BEGIN
  IF p_locale NOT IN ('en', 'th') THEN
    RETURN;
  END IF;
  IF v_name IS NULL AND v_tagline IS NULL AND v_description IS NULL
     AND v_directions IS NULL THEN
    IF p_locale = 'th' THEN
      DELETE FROM public.venue_translations
      WHERE venue_id = p_venue_id AND locale = 'th';
    END IF;
    RETURN;
  END IF;

  INSERT INTO public.venue_translations (
    venue_id, locale, name, tagline, description, directions, updated_by
  ) VALUES (
    p_venue_id, p_locale, v_name, v_tagline, v_description, v_directions, p_actor
  )
  ON CONFLICT (venue_id, locale)
  DO UPDATE SET
    name = EXCLUDED.name,
    tagline = EXCLUDED.tagline,
    description = EXCLUDED.description,
    directions = EXCLUDED.directions,
    updated_by = EXCLUDED.updated_by,
    updated_at = pg_catalog.now();
END;
$$;

CREATE FUNCTION public.save_venue_opening_hours(p_venue_id uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := app_private.current_user_id();
  v_venue public.venues%ROWTYPE;
  v_expected timestamptz;
  v_error text;
BEGIN
  IF v_actor IS NULL THEN
    RETURN app_private.venue_profile_error('unauthenticated');
  END IF;
  IF NOT app_private.may_manage_venue_profile(p_venue_id) THEN
    RETURN app_private.venue_profile_error('forbidden');
  END IF;
  SELECT * INTO v_venue FROM public.venues v WHERE v.id = p_venue_id;
  IF NOT FOUND THEN
    RETURN app_private.venue_profile_error('not_found');
  END IF;
  BEGIN
    v_expected := (p_payload->>'expected_updated_at')::timestamptz;
  EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
    RETURN app_private.venue_profile_error('invalid_payload');
  END;
  IF v_expected IS NULL OR v_venue.updated_at IS DISTINCT FROM v_expected THEN
    RETURN app_private.venue_profile_error('conflict');
  END IF;

  BEGIN
    v_error := app_private.replace_venue_hours(p_venue_id, v_actor, p_payload);
    IF v_error IS NOT NULL THEN
      RAISE EXCEPTION 'invalid_payload' USING ERRCODE = '22023';
    END IF;
  EXCEPTION
    WHEN invalid_parameter_value
      OR exclusion_violation
      OR check_violation
      OR unique_violation THEN
      RETURN app_private.venue_profile_error('invalid_payload');
  END;

  PERFORM app_private.write_venue_profile_audit(
    'manage_venue',
    v_venue.business_id,
    p_venue_id,
    'Updated venue opening hours',
    pg_catalog.jsonb_build_object('mode', v_venue.opening_hours_mode),
    pg_catalog.jsonb_build_object('mode', p_payload->>'mode'),
    ARRAY['opening_hours_mode', 'weekly_hours', 'exceptions']
  );

  SELECT updated_at INTO v_expected FROM public.venues WHERE id = p_venue_id;
  RETURN pg_catalog.jsonb_build_object('ok', true, 'updated_at', v_expected);
END;
$$;

CREATE FUNCTION public.set_venue_publication(p_venue_id uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := app_private.current_user_id();
  v_venue public.venues%ROWTYPE;
  v_expected timestamptz;
  v_next text;
  v_errors text[] := ARRAY[]::text[];
BEGIN
  IF v_actor IS NULL THEN
    RETURN app_private.venue_profile_error('unauthenticated');
  END IF;
  IF NOT app_private.may_manage_venue_profile(p_venue_id) THEN
    RETURN app_private.venue_profile_error('forbidden');
  END IF;
  SELECT * INTO v_venue FROM public.venues v WHERE v.id = p_venue_id;
  IF NOT FOUND THEN
    RETURN app_private.venue_profile_error('not_found');
  END IF;
  BEGIN
    v_expected := (p_payload->>'expected_updated_at')::timestamptz;
  EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
    RETURN app_private.venue_profile_error('invalid_payload');
  END;
  IF v_expected IS NULL OR v_venue.updated_at IS DISTINCT FROM v_expected THEN
    RETURN app_private.venue_profile_error('conflict');
  END IF;

  v_next := p_payload->>'publication_state';
  IF v_next IS NULL OR v_next NOT IN ('draft', 'published') THEN
    RETURN app_private.venue_profile_error('invalid_payload');
  END IF;
  IF v_venue.publication_state = 'unpublished_by_platform' THEN
    RETURN app_private.venue_profile_error('forbidden');
  END IF;
  IF v_next = 'published' THEN
    IF v_venue.platform_quarantined_at IS NOT NULL THEN
      RETURN app_private.venue_profile_error('forbidden');
    END IF;
    IF NOT COALESCE(app_private.venue_profile_ready(p_venue_id), false) THEN
      IF char_length(pg_catalog.btrim(v_venue.name)) < 1 THEN
        v_errors := v_errors || ARRAY['name_required'];
      END IF;
      v_errors := v_errors || ARRAY['english_profile_required'];
      RETURN pg_catalog.jsonb_build_object(
        'ok', false,
        'code', 'not_ready',
        'errors', to_jsonb(v_errors)
      );
    END IF;
  END IF;

  UPDATE public.venues
  SET publication_state = v_next
  WHERE id = p_venue_id;

  PERFORM app_private.write_venue_profile_audit(
    'manage_venue',
    v_venue.business_id,
    p_venue_id,
    'Changed venue publication state',
    pg_catalog.jsonb_build_object('publication_state', v_venue.publication_state),
    pg_catalog.jsonb_build_object('publication_state', v_next),
    ARRAY['publication_state']
  );

  SELECT updated_at INTO v_expected FROM public.venues WHERE id = p_venue_id;
  RETURN pg_catalog.jsonb_build_object('ok', true, 'updated_at', v_expected);
END;
$$;

CREATE FUNCTION public.save_venue_branding(p_venue_id uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := app_private.current_user_id();
  v_venue public.venues%ROWTYPE;
  v_theme text;
  v_font text;
BEGIN
  IF v_actor IS NULL THEN
    RETURN app_private.venue_profile_error('unauthenticated');
  END IF;
  IF NOT app_private.may_manage_venue_branding(p_venue_id) THEN
    RETURN app_private.venue_profile_error('forbidden');
  END IF;
  SELECT * INTO v_venue FROM public.venues v WHERE v.id = p_venue_id;
  IF NOT FOUND THEN
    RETURN app_private.venue_profile_error('not_found');
  END IF;

  v_theme := COALESCE(p_payload->>'theme_key', 'system');
  v_font := COALESCE(p_payload->>'font_key', 'system');
  IF NOT EXISTS (SELECT 1 FROM public.branding_themes t WHERE t.key = v_theme) THEN
    RETURN app_private.venue_profile_error('invalid_payload');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.branding_fonts f WHERE f.key = v_font) THEN
    RETURN app_private.venue_profile_error('invalid_payload');
  END IF;
  IF upper(COALESCE(p_payload->>'primary_color', '')) !~ '^#[0-9A-F]{6}$'
     OR upper(COALESCE(p_payload->>'secondary_color', '')) !~ '^#[0-9A-F]{6}$'
     OR upper(COALESCE(p_payload->>'accent_color', '')) !~ '^#[0-9A-F]{6}$'
     OR upper(COALESCE(p_payload->>'background_color', '')) !~ '^#[0-9A-F]{6}$'
     OR upper(COALESCE(p_payload->>'text_color', '')) !~ '^#[0-9A-F]{6}$' THEN
    RETURN app_private.venue_profile_error('invalid_payload');
  END IF;

  INSERT INTO public.venue_branding (
    venue_id, primary_color, secondary_color, accent_color, background_color,
    text_color, theme_key, font_key, updated_by
  ) VALUES (
    p_venue_id,
    upper(p_payload->>'primary_color'),
    upper(p_payload->>'secondary_color'),
    upper(p_payload->>'accent_color'),
    upper(p_payload->>'background_color'),
    upper(p_payload->>'text_color'),
    v_theme,
    v_font,
    v_actor
  )
  ON CONFLICT (venue_id)
  DO UPDATE SET
    primary_color = EXCLUDED.primary_color,
    secondary_color = EXCLUDED.secondary_color,
    accent_color = EXCLUDED.accent_color,
    background_color = EXCLUDED.background_color,
    text_color = EXCLUDED.text_color,
    theme_key = EXCLUDED.theme_key,
    font_key = EXCLUDED.font_key,
    updated_by = EXCLUDED.updated_by,
    updated_at = pg_catalog.now();

  PERFORM app_private.write_venue_profile_audit(
    'manage_branding',
    v_venue.business_id,
    p_venue_id,
    'Updated venue branding',
    pg_catalog.jsonb_build_object('theme_key', 'previous'),
    pg_catalog.jsonb_build_object('theme_key', v_theme),
    ARRAY['theme_key', 'font_key', 'colors']
  );

  RETURN pg_catalog.jsonb_build_object('ok', true);
END;
$$;

CREATE FUNCTION public.list_public_venue_profile(p_venue_slug text, p_locale text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_venue public.venues%ROWTYPE;
  v_locale text := CASE WHEN p_locale = 'th' THEN 'th' ELSE 'en' END;
  v_preview boolean := false;
  v_translation public.venue_translations%ROWTYPE;
  v_week jsonb;
  v_exceptions jsonb;
  v_contacts jsonb;
BEGIN
  IF p_venue_slug IS NULL OR char_length(p_venue_slug) < 1 THEN
    RETURN app_private.venue_profile_error('not_found');
  END IF;

  SELECT * INTO v_venue FROM public.venues v WHERE v.slug = p_venue_slug;
  IF NOT FOUND THEN
    RETURN app_private.venue_profile_error('not_found');
  END IF;

  IF app_private.venue_is_publicly_visible(v_venue.id) THEN
    v_preview := false;
  ELSIF app_private.may_preview_venue(v_venue.id) THEN
    v_preview := true;
  ELSE
    RETURN pg_catalog.jsonb_build_object(
      'ok', true,
      'available', false
    );
  END IF;

  SELECT * INTO v_translation
  FROM public.venue_translations t
  WHERE t.venue_id = v_venue.id AND t.locale = v_locale;

  IF NOT FOUND THEN
    SELECT * INTO v_translation
    FROM public.venue_translations t
    WHERE t.venue_id = v_venue.id AND t.locale = v_venue.default_locale;
  END IF;

  IF NOT FOUND THEN
    SELECT * INTO v_translation
    FROM public.venue_translations t
    WHERE t.venue_id = v_venue.id
    ORDER BY t.locale
    LIMIT 1;
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'type', c.contact_type,
        'value', c.value
      )
      ORDER BY c.sort_order, c.contact_type
    ),
    '[]'::jsonb
  )
  INTO v_contacts
  FROM public.venue_contacts c
  WHERE c.venue_id = v_venue.id AND c.is_public;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'day', h.day_of_week,
        'opens', to_char(h.opens_local, 'HH24:MI'),
        'closes', to_char(h.closes_local, 'HH24:MI'),
        'closes_next_day', h.closes_next_day
      )
      ORDER BY h.day_of_week, h.sort_order
    ),
    '[]'::jsonb
  )
  INTO v_week
  FROM public.venue_opening_hours h
  WHERE h.venue_id = v_venue.id;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'date', e.exception_date,
        'closed', e.is_closed,
        'intervals', COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'opens', to_char(i.opens_local, 'HH24:MI'),
              'closes', to_char(i.closes_local, 'HH24:MI'),
              'closes_next_day', i.closes_next_day
            )
            ORDER BY i.sort_order
          )
          FROM public.venue_hours_exception_intervals i
          WHERE i.exception_id = e.id
        ), '[]'::jsonb)
      )
      ORDER BY e.exception_date
    ),
    '[]'::jsonb
  )
  INTO v_exceptions
  FROM public.venue_hours_exceptions e
  WHERE e.venue_id = v_venue.id;

  RETURN pg_catalog.jsonb_build_object(
    'ok', true,
    'available', true,
    'preview', v_preview,
    'publication_state', v_venue.publication_state,
    'timezone', v_venue.timezone,
    'hours_mode', v_venue.opening_hours_mode,
    'name', COALESCE(v_translation.name, v_venue.name),
    'tagline', v_translation.tagline,
    'description', v_translation.description,
    'directions', v_translation.directions,
    'address_line1', v_venue.address_line1,
    'address_line2', v_venue.address_line2,
    'city', v_venue.city,
    'province', v_venue.province,
    'postal_code', v_venue.postal_code,
    'country', v_venue.country,
    'latitude', v_venue.latitude,
    'longitude', v_venue.longitude,
    'content_classification', v_venue.content_classification,
    'contacts', COALESCE(v_contacts, '[]'::jsonb),
    'weekly_intervals', COALESCE(v_week, '[]'::jsonb),
    'closed_weekdays', COALESCE((
      SELECT jsonb_agg(d.day_of_week ORDER BY d.day_of_week)
      FROM public.venue_closed_weekdays d
      WHERE d.venue_id = v_venue.id
    ), '[]'::jsonb),
    'exceptions', COALESCE(v_exceptions, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION app_private.venue_profile_error(text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.venue_profile_parse_time(text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.venue_contact_value_ok(text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.venue_profile_ready(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.replace_venue_hours(uuid, uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.upsert_venue_profile_translation(
  uuid, text, text, text, text, text, uuid
) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.save_venue_public_profile(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_venue_opening_hours(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_venue_publication(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_venue_branding(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_public_venue_profile(text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.save_venue_public_profile(uuid, jsonb)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_venue_opening_hours(uuid, jsonb)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_venue_publication(uuid, jsonb)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_venue_branding(uuid, jsonb)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_public_venue_profile(text, text)
  TO anon, authenticated;

