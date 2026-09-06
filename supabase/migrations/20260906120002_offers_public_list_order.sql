-- Deterministic public offer pagination order.

CREATE OR REPLACE FUNCTION public.list_public_venue_offers(
  p_venue_slug text,
  p_locale text DEFAULT 'en',
  p_limit integer DEFAULT 12,
  p_cursor text DEFAULT NULL
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
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 12), 1), 24);
  v_settings jsonb := '{}'::jsonb;
  v_heading text;
  v_preview boolean := true;
  v_preview_count integer := 3;
  v_cursor jsonb;
  v_ts timestamptz;
  v_id uuid;
  v_items jsonb := '[]'::jsonb;
  v_next text;
BEGIN
  IF p_venue_slug IS NULL OR pg_catalog.btrim(p_venue_slug) = '' THEN
    RETURN pg_catalog.jsonb_build_object('ok', true, 'available', false);
  END IF;

  SELECT * INTO v_venue
  FROM public.venues v
  WHERE v.slug = p_venue_slug;

  IF NOT FOUND OR NOT app_private.offers_module_public(v_venue.id) THEN
    RETURN pg_catalog.jsonb_build_object('ok', true, 'available', false);
  END IF;

  SELECT s.settings INTO v_settings
  FROM public.venue_module_settings s
  WHERE s.venue_id = v_venue.id AND s.module_key = 'offers';

  v_preview := COALESCE((v_settings->>'homepage_preview_enabled')::boolean, true);
  v_preview_count := LEAST(
    6,
    GREATEST(1, COALESCE((v_settings->>'homepage_preview_count')::integer, 3))
  );

  SELECT t.public_heading INTO v_heading
  FROM public.venue_module_setting_translations t
  JOIN public.venue_module_settings s
    ON s.id = t.venue_module_setting_id AND s.venue_id = t.venue_id
  WHERE s.venue_id = v_venue.id
    AND s.module_key = 'offers'
    AND t.locale = v_locale;

  IF v_heading IS NULL THEN
    SELECT t.public_heading INTO v_heading
    FROM public.venue_module_setting_translations t
    JOIN public.venue_module_settings s
      ON s.id = t.venue_module_setting_id AND s.venue_id = t.venue_id
    WHERE s.venue_id = v_venue.id
      AND s.module_key = 'offers'
      AND t.locale = 'en';
  END IF;

  IF p_cursor IS NOT NULL AND pg_catalog.btrim(p_cursor) <> '' THEN
    BEGIN
      v_cursor := pg_catalog.convert_from(
        pg_catalog.decode(replace(p_cursor, E'\n', ''), 'base64'),
        'UTF8'
      )::jsonb;
      v_ts := (v_cursor->>'t')::timestamptz;
      v_id := (v_cursor->>'i')::uuid;
    EXCEPTION WHEN OTHERS THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok', true,
        'available', true,
        'heading', v_heading,
        'preview_enabled', v_preview,
        'preview_count', v_preview_count,
        'timezone', v_venue.timezone,
        'items', '[]'::jsonb,
        'next_cursor', NULL
      );
    END;
  END IF;

  WITH ranked AS (
    SELECT
      COALESCE(tr_req.title, tr_en.title) AS title,
      COALESCE(tr_req.description, tr_en.description) AS description,
      COALESCE(tr_req.terms, tr_en.terms) AS terms,
      CASE WHEN tr_req.offer_id IS NOT NULL THEN v_locale ELSE 'en' END AS locale,
      o.valid_from,
      o.valid_until,
      o.id
    FROM public.offers o
    JOIN public.offer_translations tr_en
      ON tr_en.offer_id = o.id AND tr_en.locale = 'en'
    LEFT JOIN public.offer_translations tr_req
      ON tr_req.offer_id = o.id AND tr_req.locale = v_locale
    WHERE o.venue_id = v_venue.id
      AND app_private.offer_is_publicly_visible(
        o.state,
        o.scheduled_for,
        o.published_at,
        o.valid_from,
        o.valid_until,
        o.archived_at,
        o.platform_quarantined_at
      )
      AND (
        v_ts IS NULL
        OR (o.valid_from, o.id) > (v_ts, v_id)
      )
    ORDER BY o.valid_from ASC, o.id ASC
    LIMIT v_limit + 1
  )
  SELECT
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'title', r.title,
          'description', r.description,
          'terms', r.terms,
          'valid_from', r.valid_from,
          'valid_until', r.valid_until,
          'locale', r.locale
        )
        ORDER BY r.valid_from ASC, r.id ASC
      ) FILTER (WHERE r.ord <= v_limit),
      '[]'::jsonb
    ),
    CASE
      WHEN max(r.ord) FILTER (WHERE r.ord = v_limit + 1) IS NOT NULL THEN
        app_private.offer_encode_cursor(
          (array_agg(r.valid_from ORDER BY r.ord))[v_limit],
          (array_agg(r.id ORDER BY r.ord))[v_limit]
        )
      ELSE NULL
    END
  INTO v_items, v_next
  FROM (
    SELECT
      ranked.*,
      row_number() OVER (ORDER BY ranked.valid_from ASC, ranked.id ASC) AS ord
    FROM ranked
  ) r;

  RETURN pg_catalog.jsonb_build_object(
    'ok', true,
    'available', true,
    'heading', v_heading,
    'preview_enabled', v_preview,
    'preview_count', v_preview_count,
    'timezone', v_venue.timezone,
    'items', COALESCE(v_items, '[]'::jsonb),
    'next_cursor', v_next
  );
END;
$$;

REVOKE ALL ON FUNCTION public.list_public_venue_offers(text, text, integer, text)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_public_venue_offers(text, text, integer, text)
  TO anon, authenticated;
