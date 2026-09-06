-- Offer write and public-read RPCs. Codes only. search_path is empty.
-- No C18 copy. No redemption.

CREATE FUNCTION app_private.offer_error(p_code text)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT pg_catalog.jsonb_build_object('ok', false, 'code', p_code);
$$;

CREATE FUNCTION app_private.upsert_offer_translation(
  p_offer_id uuid,
  p_venue_id uuid,
  p_locale text,
  p_title text,
  p_description text,
  p_terms text,
  p_actor uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_title text;
  v_description text;
  v_terms text;
BEGIN
  IF p_locale IS NULL OR p_locale NOT IN ('en', 'th') THEN
    RETURN;
  END IF;

  v_title := NULLIF(pg_catalog.btrim(COALESCE(p_title, '')), '');
  v_description := NULLIF(pg_catalog.btrim(COALESCE(p_description, '')), '');
  v_terms := NULLIF(pg_catalog.btrim(COALESCE(p_terms, '')), '');

  IF v_title IS NULL AND v_description IS NULL AND v_terms IS NULL THEN
    DELETE FROM public.offer_translations t
    WHERE t.offer_id = p_offer_id
      AND t.locale = p_locale;
    RETURN;
  END IF;

  IF v_title IS NULL OR v_description IS NULL OR v_terms IS NULL THEN
    RAISE EXCEPTION 'invalid offer translation'
      USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.offer_translations (
    offer_id, venue_id, locale, title, description, terms, updated_by
  )
  VALUES (
    p_offer_id, p_venue_id, p_locale, v_title, v_description, v_terms, p_actor
  )
  ON CONFLICT (offer_id, locale)
  DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    terms = EXCLUDED.terms,
    updated_by = EXCLUDED.updated_by,
    updated_at = pg_catalog.now();
END;
$$;

CREATE FUNCTION app_private.offer_has_english(p_offer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.offer_translations t
    WHERE t.offer_id = p_offer_id
      AND t.locale = 'en'
  );
$$;

CREATE FUNCTION app_private.offer_write_translations(
  p_offer_id uuid,
  p_venue_id uuid,
  p_payload jsonb,
  p_actor uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  BEGIN
    PERFORM app_private.upsert_offer_translation(
      p_offer_id, p_venue_id, 'en',
      p_payload->>'title_en',
      p_payload->>'description_en',
      p_payload->>'terms_en',
      p_actor
    );
    PERFORM app_private.upsert_offer_translation(
      p_offer_id, p_venue_id, 'th',
      p_payload->>'title_th',
      p_payload->>'description_th',
      p_payload->>'terms_th',
      p_actor
    );
  EXCEPTION WHEN check_violation THEN
    RETURN false;
  END;
  RETURN app_private.offer_has_english(p_offer_id);
END;
$$;

CREATE FUNCTION app_private.offer_encode_cursor(
  p_sort_at timestamptz,
  p_id uuid
)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT pg_catalog.replace(
    pg_catalog.encode(
      pg_catalog.convert_to(
        pg_catalog.jsonb_build_object('t', p_sort_at, 'i', p_id)::text,
        'UTF8'
      ),
      'base64'
    ),
    E'\n',
    ''
  );
$$;

CREATE FUNCTION public.create_offer(p_venue_id uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := app_private.current_user_id();
  v_venue public.venues%ROWTYPE;
  v_offer_id uuid := pg_catalog.gen_random_uuid();
  v_media text;
  v_from timestamptz;
  v_until timestamptz;
BEGIN
  IF v_actor IS NULL THEN
    RETURN app_private.offer_error('unauthenticated');
  END IF;
  IF p_venue_id IS NULL OR p_payload IS NULL
     OR jsonb_typeof(p_payload) <> 'object' THEN
    RETURN app_private.offer_error('invalid_payload');
  END IF;
  IF NOT app_private.may_create_offer(p_venue_id) THEN
    RETURN app_private.offer_error('forbidden');
  END IF;

  SELECT * INTO v_venue FROM public.venues v WHERE v.id = p_venue_id;
  IF NOT FOUND THEN
    RETURN app_private.offer_error('not_found');
  END IF;

  v_from := app_private.offers_parse_venue_local(
    v_venue.timezone, p_payload->>'valid_from_local'
  );
  v_until := app_private.offers_parse_venue_local(
    v_venue.timezone, p_payload->>'valid_until_local'
  );
  IF v_from IS NULL OR v_until IS NULL OR v_until <= v_from THEN
    RETURN app_private.offer_error('invalid_payload');
  END IF;

  v_media := NULLIF(pg_catalog.btrim(COALESCE(p_payload->>'media_storage_path', '')), '');
  IF v_media IS NOT NULL
     AND NOT app_private.offers_media_path_ok(p_venue_id, v_media) THEN
    RETURN app_private.offer_error('invalid_payload');
  END IF;

  INSERT INTO public.offers (
    id, venue_id, business_id, state, valid_from, valid_until,
    media_storage_path, created_by, updated_by
  )
  VALUES (
    v_offer_id, p_venue_id, v_venue.business_id, 'draft', v_from, v_until,
    v_media, v_actor, v_actor
  );

  IF NOT app_private.offer_write_translations(
    v_offer_id, p_venue_id, p_payload, v_actor
  ) THEN
    RETURN app_private.offer_error('invalid_payload');
  END IF;

  PERFORM app_private.append_offer_event(
    v_offer_id, p_venue_id, 'created', NULL, 'draft'
  );
  PERFORM app_private.write_offer_audit(
    'create_content', v_venue.business_id, p_venue_id, v_offer_id,
    'Created offer draft',
    NULL,
    pg_catalog.jsonb_build_object('state', 'draft')
  );

  RETURN pg_catalog.jsonb_build_object('ok', true, 'offer_id', v_offer_id);
END;
$$;

CREATE FUNCTION public.update_offer_draft(p_offer_id uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := app_private.current_user_id();
  v_offer public.offers%ROWTYPE;
  v_venue public.venues%ROWTYPE;
  v_media text;
  v_from timestamptz;
  v_until timestamptz;
BEGIN
  IF v_actor IS NULL THEN
    RETURN app_private.offer_error('unauthenticated');
  END IF;
  IF p_offer_id IS NULL OR p_payload IS NULL
     OR jsonb_typeof(p_payload) <> 'object' THEN
    RETURN app_private.offer_error('invalid_payload');
  END IF;

  SELECT * INTO v_offer FROM public.offers o WHERE o.id = p_offer_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN app_private.offer_error('not_found');
  END IF;
  IF NOT app_private.may_create_offer(v_offer.venue_id) THEN
    RETURN app_private.offer_error('forbidden');
  END IF;
  IF v_offer.state <> 'draft' THEN
    RETURN app_private.offer_error('conflict');
  END IF;

  SELECT * INTO v_venue FROM public.venues v WHERE v.id = v_offer.venue_id;

  v_from := app_private.offers_parse_venue_local(
    v_venue.timezone, p_payload->>'valid_from_local'
  );
  v_until := app_private.offers_parse_venue_local(
    v_venue.timezone, p_payload->>'valid_until_local'
  );
  IF v_from IS NULL OR v_until IS NULL OR v_until <= v_from THEN
    RETURN app_private.offer_error('invalid_payload');
  END IF;

  v_media := NULLIF(pg_catalog.btrim(COALESCE(p_payload->>'media_storage_path', '')), '');
  IF p_payload ? 'media_storage_path' AND v_media IS NOT NULL
     AND NOT app_private.offers_media_path_ok(v_offer.venue_id, v_media) THEN
    RETURN app_private.offer_error('invalid_payload');
  END IF;

  UPDATE public.offers
  SET valid_from = v_from,
      valid_until = v_until,
      media_storage_path = CASE
        WHEN p_payload ? 'media_storage_path' THEN v_media
        ELSE media_storage_path
      END,
      approved_at = NULL,
      approved_by = NULL,
      updated_by = v_actor
  WHERE id = p_offer_id;

  IF NOT app_private.offer_write_translations(
    p_offer_id, v_offer.venue_id, p_payload, v_actor
  ) THEN
    RETURN app_private.offer_error('invalid_payload');
  END IF;

  PERFORM app_private.append_offer_event(
    p_offer_id, v_offer.venue_id, 'edited', 'draft', 'draft'
  );
  PERFORM app_private.write_offer_audit(
    'create_content', v_offer.business_id, v_offer.venue_id, p_offer_id,
    'Updated offer draft',
    pg_catalog.jsonb_build_object('state', 'draft'),
    pg_catalog.jsonb_build_object('state', 'draft', 'approved', false)
  );
  RETURN pg_catalog.jsonb_build_object('ok', true, 'offer_id', p_offer_id);
END;
$$;

CREATE FUNCTION public.submit_offer_for_approval(p_offer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_offer public.offers%ROWTYPE;
BEGIN
  IF app_private.current_user_id() IS NULL THEN
    RETURN app_private.offer_error('unauthenticated');
  END IF;
  SELECT * INTO v_offer FROM public.offers o WHERE o.id = p_offer_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN app_private.offer_error('not_found');
  END IF;
  IF NOT app_private.may_submit_offer(v_offer.venue_id) THEN
    RETURN app_private.offer_error('forbidden');
  END IF;
  IF v_offer.state <> 'draft' THEN
    RETURN app_private.offer_error('conflict');
  END IF;
  IF NOT app_private.offer_has_english(p_offer_id) THEN
    RETURN app_private.offer_error('invalid_payload');
  END IF;

  UPDATE public.offers
  SET state = 'pending_approval',
      submitted_by = app_private.current_user_id(),
      rejection_reason = NULL,
      updated_by = app_private.current_user_id()
  WHERE id = p_offer_id;

  PERFORM app_private.append_offer_event(
    p_offer_id, v_offer.venue_id, 'submitted', 'draft', 'pending_approval'
  );
  PERFORM app_private.write_offer_audit(
    'submit_content_for_approval', v_offer.business_id, v_offer.venue_id,
    p_offer_id, 'Submitted offer for approval',
    pg_catalog.jsonb_build_object('state', 'draft'),
    pg_catalog.jsonb_build_object('state', 'pending_approval')
  );
  RETURN pg_catalog.jsonb_build_object('ok', true, 'offer_id', p_offer_id);
END;
$$;

CREATE FUNCTION public.approve_offer(p_offer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := app_private.current_user_id();
  v_offer public.offers%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RETURN app_private.offer_error('unauthenticated');
  END IF;
  SELECT * INTO v_offer FROM public.offers o WHERE o.id = p_offer_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN app_private.offer_error('not_found');
  END IF;
  IF NOT app_private.may_approve_offer(v_offer.venue_id) THEN
    RETURN app_private.offer_error('forbidden');
  END IF;
  IF v_offer.submitted_by IS NOT NULL AND v_offer.submitted_by = v_actor THEN
    RETURN app_private.offer_error('forbidden');
  END IF;
  IF v_offer.state <> 'pending_approval' THEN
    RETURN app_private.offer_error('conflict');
  END IF;

  UPDATE public.offers
  SET state = 'draft',
      approved_by = v_actor,
      approved_at = pg_catalog.now(),
      rejection_reason = NULL,
      updated_by = v_actor
  WHERE id = p_offer_id;

  PERFORM app_private.append_offer_event(
    p_offer_id, v_offer.venue_id, 'approved', 'pending_approval', 'draft'
  );
  PERFORM app_private.write_offer_audit(
    'approve_content', v_offer.business_id, v_offer.venue_id, p_offer_id,
    'Approved offer',
    pg_catalog.jsonb_build_object('state', 'pending_approval'),
    pg_catalog.jsonb_build_object('state', 'draft')
  );
  RETURN pg_catalog.jsonb_build_object('ok', true, 'offer_id', p_offer_id);
END;
$$;

CREATE FUNCTION public.reject_offer(p_offer_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := app_private.current_user_id();
  v_offer public.offers%ROWTYPE;
  v_reason text;
BEGIN
  IF v_actor IS NULL THEN
    RETURN app_private.offer_error('unauthenticated');
  END IF;
  v_reason := NULLIF(pg_catalog.btrim(COALESCE(p_reason, '')), '');
  IF v_reason IS NULL OR pg_catalog.char_length(v_reason) > 500 THEN
    RETURN app_private.offer_error('invalid_payload');
  END IF;
  SELECT * INTO v_offer FROM public.offers o WHERE o.id = p_offer_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN app_private.offer_error('not_found');
  END IF;
  IF NOT app_private.may_approve_offer(v_offer.venue_id) THEN
    RETURN app_private.offer_error('forbidden');
  END IF;
  IF v_offer.state <> 'pending_approval' THEN
    RETURN app_private.offer_error('conflict');
  END IF;

  UPDATE public.offers
  SET state = 'draft',
      approved_at = NULL,
      approved_by = NULL,
      rejection_reason = v_reason,
      updated_by = v_actor
  WHERE id = p_offer_id;

  PERFORM app_private.append_offer_event(
    p_offer_id, v_offer.venue_id, 'rejected', 'pending_approval', 'draft'
  );
  PERFORM app_private.write_offer_audit(
    'approve_content', v_offer.business_id, v_offer.venue_id, p_offer_id,
    'Rejected offer',
    pg_catalog.jsonb_build_object('state', 'pending_approval'),
    pg_catalog.jsonb_build_object('state', 'draft')
  );
  RETURN pg_catalog.jsonb_build_object('ok', true, 'offer_id', p_offer_id);
END;
$$;

CREATE FUNCTION public.publish_offer_now(p_offer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_offer public.offers%ROWTYPE;
  v_now timestamptz := pg_catalog.now();
BEGIN
  IF app_private.current_user_id() IS NULL THEN
    RETURN app_private.offer_error('unauthenticated');
  END IF;
  SELECT * INTO v_offer FROM public.offers o WHERE o.id = p_offer_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN app_private.offer_error('not_found');
  END IF;
  IF NOT app_private.may_publish_offer(v_offer.venue_id) THEN
    RETURN app_private.offer_error('forbidden');
  END IF;
  IF v_offer.platform_quarantined_at IS NOT NULL THEN
    RETURN app_private.offer_error('forbidden');
  END IF;
  IF v_offer.state NOT IN ('draft', 'scheduled') THEN
    RETURN app_private.offer_error('conflict');
  END IF;
  IF NOT app_private.offer_has_english(p_offer_id) THEN
    RETURN app_private.offer_error('invalid_payload');
  END IF;
  IF app_private.offers_require_manager_approval(v_offer.venue_id)
     AND v_offer.approved_at IS NULL THEN
    RETURN app_private.offer_error('forbidden');
  END IF;

  UPDATE public.offers
  SET state = 'published',
      scheduled_for = NULL,
      published_at = v_now,
      archived_at = NULL,
      rejection_reason = NULL,
      updated_by = app_private.current_user_id()
  WHERE id = p_offer_id;

  PERFORM app_private.append_offer_event(
    p_offer_id, v_offer.venue_id, 'published', v_offer.state, 'published'
  );
  PERFORM app_private.write_offer_audit(
    'publish_content', v_offer.business_id, v_offer.venue_id, p_offer_id,
    'Published offer',
    pg_catalog.jsonb_build_object('state', v_offer.state),
    pg_catalog.jsonb_build_object('state', 'published')
  );
  RETURN pg_catalog.jsonb_build_object('ok', true, 'offer_id', p_offer_id);
END;
$$;

CREATE FUNCTION public.schedule_offer_publication(
  p_offer_id uuid,
  p_scheduled_for timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_offer public.offers%ROWTYPE;
BEGIN
  IF app_private.current_user_id() IS NULL THEN
    RETURN app_private.offer_error('unauthenticated');
  END IF;
  IF p_scheduled_for IS NULL OR p_scheduled_for <= pg_catalog.now() THEN
    RETURN app_private.offer_error('invalid_payload');
  END IF;
  SELECT * INTO v_offer FROM public.offers o WHERE o.id = p_offer_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN app_private.offer_error('not_found');
  END IF;
  IF NOT app_private.may_publish_offer(v_offer.venue_id) THEN
    RETURN app_private.offer_error('forbidden');
  END IF;
  IF v_offer.platform_quarantined_at IS NOT NULL THEN
    RETURN app_private.offer_error('forbidden');
  END IF;
  IF v_offer.state NOT IN ('draft', 'scheduled') THEN
    RETURN app_private.offer_error('conflict');
  END IF;
  IF NOT app_private.offer_has_english(p_offer_id) THEN
    RETURN app_private.offer_error('invalid_payload');
  END IF;
  IF app_private.offers_require_manager_approval(v_offer.venue_id)
     AND v_offer.approved_at IS NULL THEN
    RETURN app_private.offer_error('forbidden');
  END IF;

  UPDATE public.offers
  SET state = 'scheduled',
      scheduled_for = p_scheduled_for,
      published_at = NULL,
      archived_at = NULL,
      updated_by = app_private.current_user_id()
  WHERE id = p_offer_id;

  PERFORM app_private.append_offer_event(
    p_offer_id, v_offer.venue_id, 'scheduled', v_offer.state, 'scheduled'
  );
  PERFORM app_private.write_offer_audit(
    'publish_content', v_offer.business_id, v_offer.venue_id, p_offer_id,
    'Scheduled offer',
    pg_catalog.jsonb_build_object('state', v_offer.state),
    pg_catalog.jsonb_build_object('state', 'scheduled')
  );
  RETURN pg_catalog.jsonb_build_object('ok', true, 'offer_id', p_offer_id);
END;
$$;

CREATE FUNCTION public.unpublish_offer(p_offer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_offer public.offers%ROWTYPE;
BEGIN
  IF app_private.current_user_id() IS NULL THEN
    RETURN app_private.offer_error('unauthenticated');
  END IF;
  SELECT * INTO v_offer FROM public.offers o WHERE o.id = p_offer_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN app_private.offer_error('not_found');
  END IF;
  IF NOT app_private.may_publish_offer(v_offer.venue_id) THEN
    RETURN app_private.offer_error('forbidden');
  END IF;
  IF v_offer.state NOT IN ('published', 'scheduled') THEN
    RETURN app_private.offer_error('conflict');
  END IF;

  UPDATE public.offers
  SET state = 'draft',
      scheduled_for = NULL,
      published_at = NULL,
      updated_by = app_private.current_user_id()
  WHERE id = p_offer_id;

  PERFORM app_private.append_offer_event(
    p_offer_id, v_offer.venue_id, 'unpublished', v_offer.state, 'draft'
  );
  PERFORM app_private.write_offer_audit(
    'publish_content', v_offer.business_id, v_offer.venue_id, p_offer_id,
    'Unpublished offer',
    pg_catalog.jsonb_build_object('state', v_offer.state),
    pg_catalog.jsonb_build_object('state', 'draft')
  );
  RETURN pg_catalog.jsonb_build_object('ok', true, 'offer_id', p_offer_id);
END;
$$;

CREATE FUNCTION public.archive_offer(p_offer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_offer public.offers%ROWTYPE;
BEGIN
  IF app_private.current_user_id() IS NULL THEN
    RETURN app_private.offer_error('unauthenticated');
  END IF;
  SELECT * INTO v_offer FROM public.offers o WHERE o.id = p_offer_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN app_private.offer_error('not_found');
  END IF;
  IF NOT app_private.may_publish_offer(v_offer.venue_id) THEN
    RETURN app_private.offer_error('forbidden');
  END IF;
  IF v_offer.state = 'archived' THEN
    RETURN app_private.offer_error('conflict');
  END IF;

  UPDATE public.offers
  SET state = 'archived',
      archived_at = pg_catalog.now(),
      scheduled_for = NULL,
      updated_by = app_private.current_user_id()
  WHERE id = p_offer_id;

  PERFORM app_private.append_offer_event(
    p_offer_id, v_offer.venue_id, 'archived', v_offer.state, 'archived'
  );
  PERFORM app_private.write_offer_audit(
    'publish_content', v_offer.business_id, v_offer.venue_id, p_offer_id,
    'Archived offer',
    pg_catalog.jsonb_build_object('state', v_offer.state),
    pg_catalog.jsonb_build_object('state', 'archived')
  );
  RETURN pg_catalog.jsonb_build_object('ok', true, 'offer_id', p_offer_id);
END;
$$;

CREATE FUNCTION public.restore_offer_to_draft(p_offer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_offer public.offers%ROWTYPE;
BEGIN
  IF app_private.current_user_id() IS NULL THEN
    RETURN app_private.offer_error('unauthenticated');
  END IF;
  SELECT * INTO v_offer FROM public.offers o WHERE o.id = p_offer_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN app_private.offer_error('not_found');
  END IF;
  IF NOT app_private.may_publish_offer(v_offer.venue_id) THEN
    RETURN app_private.offer_error('forbidden');
  END IF;
  IF v_offer.state <> 'archived' THEN
    RETURN app_private.offer_error('conflict');
  END IF;

  UPDATE public.offers
  SET state = 'draft',
      archived_at = NULL,
      scheduled_for = NULL,
      published_at = NULL,
      approved_at = NULL,
      approved_by = NULL,
      updated_by = app_private.current_user_id()
  WHERE id = p_offer_id;

  PERFORM app_private.append_offer_event(
    p_offer_id, v_offer.venue_id, 'restored', 'archived', 'draft'
  );
  PERFORM app_private.write_offer_audit(
    'publish_content', v_offer.business_id, v_offer.venue_id, p_offer_id,
    'Restored offer to draft',
    pg_catalog.jsonb_build_object('state', 'archived'),
    pg_catalog.jsonb_build_object('state', 'draft')
  );
  RETURN pg_catalog.jsonb_build_object('ok', true, 'offer_id', p_offer_id);
END;
$$;

CREATE FUNCTION public.update_offers_module_settings(
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
BEGIN
  IF v_actor IS NULL THEN
    RETURN app_private.offer_error('unauthenticated');
  END IF;
  IF p_venue_id IS NULL OR p_payload IS NULL
     OR jsonb_typeof(p_payload) <> 'object' THEN
    RETURN app_private.offer_error('invalid_payload');
  END IF;
  IF NOT app_private.is_user_active() THEN
    RETURN app_private.offer_error('forbidden');
  END IF;
  IF NOT app_private.subscription_allows_tenant_writes(p_venue_id) THEN
    RETURN app_private.offer_error('forbidden');
  END IF;
  IF NOT app_private.offers_module_entitled(p_venue_id) THEN
    RETURN app_private.offer_error('forbidden');
  END IF;
  IF NOT (
    app_private.has_tenant_action_on_venue(
      'manage_venue_module_visibility',
      p_venue_id
    )
    OR app_private.platform_may_write_tenant(
      (SELECT v.business_id FROM public.venues v WHERE v.id = p_venue_id),
      p_venue_id
    )
  ) THEN
    RETURN app_private.offer_error('forbidden');
  END IF;

  v_settings := COALESCE(p_payload->'settings', '{}'::jsonb);
  IF NOT app_private.offers_settings_shape_ok(v_settings) THEN
    RETURN app_private.offer_error('invalid_payload');
  END IF;

  INSERT INTO public.venue_module_settings (
    venue_id, module_key, is_enabled, is_publicly_visible, settings, updated_by
  )
  VALUES (
    p_venue_id,
    'offers',
    COALESCE((p_payload->>'is_enabled')::boolean, true),
    COALESCE((p_payload->>'is_publicly_visible')::boolean, true),
    v_settings,
    v_actor
  )
  ON CONFLICT (venue_id, module_key)
  DO UPDATE SET
    is_enabled = EXCLUDED.is_enabled,
    is_publicly_visible = EXCLUDED.is_publicly_visible,
    settings = EXCLUDED.settings,
    updated_by = EXCLUDED.updated_by,
    updated_at = pg_catalog.now()
  RETURNING id INTO v_setting_id;

  v_heading_en := NULLIF(pg_catalog.btrim(COALESCE(p_payload->>'heading_en', '')), '');
  v_heading_th := NULLIF(pg_catalog.btrim(COALESCE(p_payload->>'heading_th', '')), '');

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

CREATE FUNCTION public.list_public_venue_offers(
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
    SELECT ranked.*, row_number() OVER () AS ord
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

REVOKE ALL ON FUNCTION app_private.offer_error(text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.upsert_offer_translation(
  uuid, uuid, text, text, text, text, uuid
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.offer_has_english(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.offer_write_translations(
  uuid, uuid, jsonb, uuid
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.offer_encode_cursor(timestamptz, uuid)
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.create_offer(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_offer_draft(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_offer_for_approval(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_offer(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reject_offer(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.publish_offer_now(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.schedule_offer_publication(uuid, timestamptz)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.unpublish_offer(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.archive_offer(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.restore_offer_to_draft(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_offers_module_settings(uuid, jsonb)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_public_venue_offers(text, text, integer, text)
  FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_offer(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_offer_draft(uuid, jsonb)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_offer_for_approval(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_offer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_offer(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_offer_now(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_offer_publication(uuid, timestamptz)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.unpublish_offer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_offer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_offer_to_draft(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_offers_module_settings(uuid, jsonb)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_public_venue_offers(
  text, text, integer, text
) TO anon, authenticated;
