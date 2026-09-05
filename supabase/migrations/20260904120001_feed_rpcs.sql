-- Feed write and public-read RPCs. Codes only. search_path is empty.

CREATE FUNCTION app_private.feed_error(p_code text)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT pg_catalog.jsonb_build_object('ok', false, 'code', p_code);
$$;

CREATE FUNCTION app_private.upsert_feed_translation(
  p_post_id uuid,
  p_venue_id uuid,
  p_locale text,
  p_title text,
  p_body text,
  p_actor uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_title text;
  v_body text;
BEGIN
  IF p_locale IS NULL OR p_locale NOT IN ('en', 'th') THEN
    RETURN;
  END IF;

  v_title := NULLIF(pg_catalog.btrim(COALESCE(p_title, '')), '');
  v_body := NULLIF(pg_catalog.btrim(COALESCE(p_body, '')), '');

  IF v_title IS NULL AND v_body IS NULL THEN
    DELETE FROM public.feed_post_translations t
    WHERE t.post_id = p_post_id
      AND t.locale = p_locale;
    RETURN;
  END IF;

  IF v_title IS NULL OR v_body IS NULL THEN
    RAISE EXCEPTION 'invalid feed translation'
      USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.feed_post_translations (
    post_id, venue_id, locale, title, body, updated_by
  )
  VALUES (
    p_post_id, p_venue_id, p_locale, v_title, v_body, p_actor
  )
  ON CONFLICT (post_id, locale)
  DO UPDATE SET
    title = EXCLUDED.title,
    body = EXCLUDED.body,
    updated_by = EXCLUDED.updated_by,
    updated_at = pg_catalog.now();
END;
$$;

CREATE FUNCTION app_private.feed_has_english(p_post_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.feed_post_translations t
    WHERE t.post_id = p_post_id
      AND t.locale = 'en'
  );
$$;

CREATE FUNCTION app_private.feed_write_translations(
  p_post_id uuid,
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
    PERFORM app_private.upsert_feed_translation(
      p_post_id, p_venue_id, 'en',
      p_payload->>'title_en', p_payload->>'body_en', p_actor
    );
    PERFORM app_private.upsert_feed_translation(
      p_post_id, p_venue_id, 'th',
      p_payload->>'title_th', p_payload->>'body_th', p_actor
    );
  EXCEPTION WHEN check_violation THEN
    RETURN false;
  END;
  RETURN app_private.feed_has_english(p_post_id);
END;
$$;

CREATE FUNCTION app_private.feed_encode_cursor(
  p_pinned boolean,
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
        pg_catalog.jsonb_build_object(
          'p', CASE WHEN p_pinned THEN 1 ELSE 0 END,
          't', p_sort_at,
          'i', p_id
        )::text,
        'UTF8'
      ),
      'base64'
    ),
    E'\n',
    ''
  );
$$;

CREATE FUNCTION public.create_feed_post(p_venue_id uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := app_private.current_user_id();
  v_venue public.venues%ROWTYPE;
  v_post_id uuid := pg_catalog.gen_random_uuid();
  v_type text;
  v_media text;
  v_title_en text;
  v_body_en text;
  v_title_th text;
  v_body_th text;
BEGIN
  IF v_actor IS NULL THEN
    RETURN app_private.feed_error('unauthenticated');
  END IF;
  IF p_venue_id IS NULL OR p_payload IS NULL
     OR jsonb_typeof(p_payload) <> 'object' THEN
    RETURN app_private.feed_error('invalid_payload');
  END IF;
  IF NOT app_private.may_create_feed_post(p_venue_id) THEN
    RETURN app_private.feed_error('forbidden');
  END IF;

  SELECT * INTO v_venue FROM public.venues v WHERE v.id = p_venue_id;
  IF NOT FOUND THEN
    RETURN app_private.feed_error('not_found');
  END IF;

  v_type := COALESCE(p_payload->>'post_type', 'update');
  IF v_type NOT IN ('update', 'announcement', 'notice') THEN
    RETURN app_private.feed_error('invalid_payload');
  END IF;

  v_title_en := NULLIF(pg_catalog.btrim(COALESCE(p_payload->>'title_en', '')), '');
  v_body_en := NULLIF(pg_catalog.btrim(COALESCE(p_payload->>'body_en', '')), '');
  IF v_title_en IS NULL OR v_body_en IS NULL
     OR pg_catalog.char_length(v_title_en) > 120
     OR pg_catalog.char_length(v_body_en) > 2000 THEN
    RETURN app_private.feed_error('invalid_payload');
  END IF;
  v_title_th := NULLIF(pg_catalog.btrim(COALESCE(p_payload->>'title_th', '')), '');
  v_body_th := NULLIF(pg_catalog.btrim(COALESCE(p_payload->>'body_th', '')), '');
  IF (v_title_th IS NULL) <> (v_body_th IS NULL)
     OR (
       v_title_th IS NOT NULL
       AND (
         pg_catalog.char_length(v_title_th) > 120
         OR pg_catalog.char_length(v_body_th) > 2000
       )
     ) THEN
    RETURN app_private.feed_error('invalid_payload');
  END IF;

  v_media := NULLIF(pg_catalog.btrim(COALESCE(p_payload->>'media_storage_path', '')), '');
  IF v_media IS NOT NULL
     AND NOT app_private.feed_media_path_ok(p_venue_id, v_media) THEN
    RETURN app_private.feed_error('invalid_payload');
  END IF;

  INSERT INTO public.feed_posts (
    id, venue_id, business_id, post_type, state, media_storage_path,
    created_by, updated_by
  )
  VALUES (
    v_post_id, p_venue_id, v_venue.business_id, v_type, 'draft', v_media,
    v_actor, v_actor
  );

  IF NOT app_private.feed_write_translations(
    v_post_id, p_venue_id, p_payload, v_actor
  ) THEN
    RETURN app_private.feed_error('invalid_payload');
  END IF;

  PERFORM app_private.append_feed_event(
    v_post_id, p_venue_id, 'created', NULL, 'draft'
  );
  PERFORM app_private.write_feed_audit(
    'create_content', v_venue.business_id, p_venue_id, v_post_id,
    'Created feed draft',
    NULL,
    pg_catalog.jsonb_build_object('state', 'draft', 'post_type', v_type)
  );

  RETURN pg_catalog.jsonb_build_object('ok', true, 'post_id', v_post_id);
END;
$$;

CREATE FUNCTION public.update_feed_post_draft(p_post_id uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := app_private.current_user_id();
  v_post public.feed_posts%ROWTYPE;
  v_type text;
  v_media text;
BEGIN
  IF v_actor IS NULL THEN
    RETURN app_private.feed_error('unauthenticated');
  END IF;
  IF p_post_id IS NULL OR p_payload IS NULL
     OR jsonb_typeof(p_payload) <> 'object' THEN
    RETURN app_private.feed_error('invalid_payload');
  END IF;

  SELECT * INTO v_post FROM public.feed_posts p WHERE p.id = p_post_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN app_private.feed_error('not_found');
  END IF;
  IF NOT app_private.may_create_feed_post(v_post.venue_id) THEN
    RETURN app_private.feed_error('forbidden');
  END IF;
  IF v_post.state <> 'draft' THEN
    RETURN app_private.feed_error('conflict');
  END IF;

  v_type := COALESCE(p_payload->>'post_type', v_post.post_type);
  IF v_type NOT IN ('update', 'announcement', 'notice') THEN
    RETURN app_private.feed_error('invalid_payload');
  END IF;

  v_media := NULLIF(pg_catalog.btrim(COALESCE(p_payload->>'media_storage_path', '')), '');
  IF p_payload ? 'media_storage_path' AND v_media IS NOT NULL
     AND NOT app_private.feed_media_path_ok(v_post.venue_id, v_media) THEN
    RETURN app_private.feed_error('invalid_payload');
  END IF;

  UPDATE public.feed_posts
  SET post_type = v_type,
      media_storage_path = CASE
        WHEN p_payload ? 'media_storage_path' THEN v_media
        ELSE media_storage_path
      END,
      approved_at = NULL,
      approved_by = NULL,
      updated_by = v_actor
  WHERE id = p_post_id;

  IF NOT app_private.feed_write_translations(
    p_post_id, v_post.venue_id, p_payload, v_actor
  ) THEN
    RETURN app_private.feed_error('invalid_payload');
  END IF;

  PERFORM app_private.append_feed_event(
    p_post_id, v_post.venue_id, 'edited', 'draft', 'draft'
  );
  PERFORM app_private.write_feed_audit(
    'create_content', v_post.business_id, v_post.venue_id, p_post_id,
    'Updated feed draft',
    pg_catalog.jsonb_build_object('state', 'draft'),
    pg_catalog.jsonb_build_object('state', 'draft', 'approved', false)
  );
  RETURN pg_catalog.jsonb_build_object('ok', true, 'post_id', p_post_id);
END;
$$;

CREATE FUNCTION public.submit_feed_post_for_approval(p_post_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_post public.feed_posts%ROWTYPE;
BEGIN
  IF app_private.current_user_id() IS NULL THEN
    RETURN app_private.feed_error('unauthenticated');
  END IF;
  SELECT * INTO v_post FROM public.feed_posts p WHERE p.id = p_post_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN app_private.feed_error('not_found');
  END IF;
  IF NOT app_private.may_submit_feed_post(v_post.venue_id) THEN
    RETURN app_private.feed_error('forbidden');
  END IF;
  IF v_post.state <> 'draft' THEN
    RETURN app_private.feed_error('conflict');
  END IF;
  IF NOT app_private.feed_has_english(p_post_id) THEN
    RETURN app_private.feed_error('invalid_payload');
  END IF;

  UPDATE public.feed_posts
  SET state = 'pending_approval',
      submitted_by = app_private.current_user_id(),
      rejection_reason = NULL,
      updated_by = app_private.current_user_id()
  WHERE id = p_post_id;

  PERFORM app_private.append_feed_event(
    p_post_id, v_post.venue_id, 'submitted', 'draft', 'pending_approval'
  );
  PERFORM app_private.write_feed_audit(
    'submit_content_for_approval', v_post.business_id, v_post.venue_id,
    p_post_id, 'Submitted feed post for approval',
    pg_catalog.jsonb_build_object('state', 'draft'),
    pg_catalog.jsonb_build_object('state', 'pending_approval')
  );
  RETURN pg_catalog.jsonb_build_object('ok', true, 'post_id', p_post_id);
END;
$$;

CREATE FUNCTION public.approve_feed_post(p_post_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := app_private.current_user_id();
  v_post public.feed_posts%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RETURN app_private.feed_error('unauthenticated');
  END IF;
  SELECT * INTO v_post FROM public.feed_posts p WHERE p.id = p_post_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN app_private.feed_error('not_found');
  END IF;
  IF NOT app_private.may_approve_feed_post(v_post.venue_id) THEN
    RETURN app_private.feed_error('forbidden');
  END IF;
  IF v_post.submitted_by IS NOT NULL AND v_post.submitted_by = v_actor THEN
    RETURN app_private.feed_error('forbidden');
  END IF;
  IF v_post.state <> 'pending_approval' THEN
    RETURN app_private.feed_error('conflict');
  END IF;

  UPDATE public.feed_posts
  SET state = 'draft',
      approved_by = v_actor,
      approved_at = pg_catalog.now(),
      rejection_reason = NULL,
      updated_by = v_actor
  WHERE id = p_post_id;

  PERFORM app_private.append_feed_event(
    p_post_id, v_post.venue_id, 'approved', 'pending_approval', 'draft'
  );
  PERFORM app_private.write_feed_audit(
    'approve_content', v_post.business_id, v_post.venue_id, p_post_id,
    'Approved feed post',
    pg_catalog.jsonb_build_object('state', 'pending_approval'),
    pg_catalog.jsonb_build_object('state', 'draft')
  );
  RETURN pg_catalog.jsonb_build_object('ok', true, 'post_id', p_post_id);
END;
$$;

CREATE FUNCTION public.reject_feed_post(p_post_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := app_private.current_user_id();
  v_post public.feed_posts%ROWTYPE;
  v_reason text;
BEGIN
  IF v_actor IS NULL THEN
    RETURN app_private.feed_error('unauthenticated');
  END IF;
  v_reason := NULLIF(pg_catalog.btrim(COALESCE(p_reason, '')), '');
  IF v_reason IS NULL OR pg_catalog.char_length(v_reason) > 500 THEN
    RETURN app_private.feed_error('invalid_payload');
  END IF;
  SELECT * INTO v_post FROM public.feed_posts p WHERE p.id = p_post_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN app_private.feed_error('not_found');
  END IF;
  IF NOT app_private.may_approve_feed_post(v_post.venue_id) THEN
    RETURN app_private.feed_error('forbidden');
  END IF;
  IF v_post.submitted_by IS NOT NULL AND v_post.submitted_by = v_actor THEN
    RETURN app_private.feed_error('forbidden');
  END IF;
  IF v_post.state <> 'pending_approval' THEN
    RETURN app_private.feed_error('conflict');
  END IF;

  UPDATE public.feed_posts
  SET state = 'draft',
      rejection_reason = v_reason,
      approved_by = NULL,
      approved_at = NULL,
      updated_by = v_actor
  WHERE id = p_post_id;

  PERFORM app_private.append_feed_event(
    p_post_id, v_post.venue_id, 'rejected', 'pending_approval', 'draft'
  );
  PERFORM app_private.write_feed_audit(
    'approve_content', v_post.business_id, v_post.venue_id, p_post_id,
    'Rejected feed post',
    pg_catalog.jsonb_build_object('state', 'pending_approval'),
    pg_catalog.jsonb_build_object('state', 'draft')
  );
  RETURN pg_catalog.jsonb_build_object('ok', true, 'post_id', p_post_id);
END;
$$;

CREATE FUNCTION public.publish_feed_post_now(p_post_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_post public.feed_posts%ROWTYPE;
  v_now timestamptz := pg_catalog.now();
BEGIN
  IF app_private.current_user_id() IS NULL THEN
    RETURN app_private.feed_error('unauthenticated');
  END IF;
  SELECT * INTO v_post FROM public.feed_posts p WHERE p.id = p_post_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN app_private.feed_error('not_found');
  END IF;
  IF NOT app_private.may_publish_feed_post(v_post.venue_id) THEN
    RETURN app_private.feed_error('forbidden');
  END IF;
  IF v_post.platform_quarantined_at IS NOT NULL THEN
    RETURN app_private.feed_error('forbidden');
  END IF;
  IF v_post.state NOT IN ('draft', 'scheduled') THEN
    RETURN app_private.feed_error('conflict');
  END IF;
  IF NOT app_private.feed_has_english(p_post_id) THEN
    RETURN app_private.feed_error('invalid_payload');
  END IF;
  IF app_private.feed_require_manager_approval(v_post.venue_id)
     AND v_post.approved_at IS NULL THEN
    RETURN app_private.feed_error('forbidden');
  END IF;

  UPDATE public.feed_posts
  SET state = 'published',
      scheduled_for = NULL,
      published_at = v_now,
      archived_at = NULL,
      rejection_reason = NULL,
      updated_by = app_private.current_user_id()
  WHERE id = p_post_id;

  PERFORM app_private.append_feed_event(
    p_post_id, v_post.venue_id, 'published', v_post.state, 'published'
  );
  PERFORM app_private.write_feed_audit(
    'publish_content', v_post.business_id, v_post.venue_id, p_post_id,
    'Published feed post',
    pg_catalog.jsonb_build_object('state', v_post.state),
    pg_catalog.jsonb_build_object('state', 'published')
  );
  RETURN pg_catalog.jsonb_build_object('ok', true, 'post_id', p_post_id);
END;
$$;

CREATE FUNCTION public.schedule_feed_post_publication(
  p_post_id uuid,
  p_scheduled_for timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_post public.feed_posts%ROWTYPE;
BEGIN
  IF app_private.current_user_id() IS NULL THEN
    RETURN app_private.feed_error('unauthenticated');
  END IF;
  IF p_scheduled_for IS NULL OR p_scheduled_for <= pg_catalog.now() THEN
    RETURN app_private.feed_error('invalid_payload');
  END IF;
  SELECT * INTO v_post FROM public.feed_posts p WHERE p.id = p_post_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN app_private.feed_error('not_found');
  END IF;
  IF NOT app_private.may_publish_feed_post(v_post.venue_id) THEN
    RETURN app_private.feed_error('forbidden');
  END IF;
  IF v_post.platform_quarantined_at IS NOT NULL THEN
    RETURN app_private.feed_error('forbidden');
  END IF;
  IF v_post.state NOT IN ('draft', 'scheduled') THEN
    RETURN app_private.feed_error('conflict');
  END IF;
  IF NOT app_private.feed_has_english(p_post_id) THEN
    RETURN app_private.feed_error('invalid_payload');
  END IF;
  IF app_private.feed_require_manager_approval(v_post.venue_id)
     AND v_post.approved_at IS NULL THEN
    RETURN app_private.feed_error('forbidden');
  END IF;

  UPDATE public.feed_posts
  SET state = 'scheduled',
      scheduled_for = p_scheduled_for,
      published_at = NULL,
      is_pinned = false,
      pinned_at = NULL,
      archived_at = NULL,
      updated_by = app_private.current_user_id()
  WHERE id = p_post_id;

  PERFORM app_private.append_feed_event(
    p_post_id, v_post.venue_id, 'scheduled', v_post.state, 'scheduled'
  );
  PERFORM app_private.write_feed_audit(
    'publish_content', v_post.business_id, v_post.venue_id, p_post_id,
    'Scheduled feed post',
    pg_catalog.jsonb_build_object('state', v_post.state),
    pg_catalog.jsonb_build_object('state', 'scheduled')
  );
  RETURN pg_catalog.jsonb_build_object('ok', true, 'post_id', p_post_id);
END;
$$;

CREATE FUNCTION public.unpublish_feed_post(p_post_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_post public.feed_posts%ROWTYPE;
BEGIN
  IF app_private.current_user_id() IS NULL THEN
    RETURN app_private.feed_error('unauthenticated');
  END IF;
  SELECT * INTO v_post FROM public.feed_posts p WHERE p.id = p_post_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN app_private.feed_error('not_found');
  END IF;
  IF NOT app_private.may_publish_feed_post(v_post.venue_id) THEN
    RETURN app_private.feed_error('forbidden');
  END IF;
  IF v_post.state NOT IN ('published', 'scheduled') THEN
    RETURN app_private.feed_error('conflict');
  END IF;

  UPDATE public.feed_posts
  SET state = 'draft',
      scheduled_for = NULL,
      published_at = NULL,
      is_pinned = false,
      pinned_at = NULL,
      archived_at = NULL,
      updated_by = app_private.current_user_id()
  WHERE id = p_post_id;

  PERFORM app_private.append_feed_event(
    p_post_id, v_post.venue_id, 'unpublished', v_post.state, 'draft'
  );
  PERFORM app_private.write_feed_audit(
    'publish_content', v_post.business_id, v_post.venue_id, p_post_id,
    'Unpublished feed post',
    pg_catalog.jsonb_build_object('state', v_post.state),
    pg_catalog.jsonb_build_object('state', 'draft')
  );
  RETURN pg_catalog.jsonb_build_object('ok', true, 'post_id', p_post_id);
END;
$$;

CREATE FUNCTION public.pin_feed_post(p_post_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_post public.feed_posts%ROWTYPE;
  v_count integer;
BEGIN
  IF app_private.current_user_id() IS NULL THEN
    RETURN app_private.feed_error('unauthenticated');
  END IF;
  SELECT * INTO v_post FROM public.feed_posts p WHERE p.id = p_post_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN app_private.feed_error('not_found');
  END IF;
  IF NOT app_private.may_publish_feed_post(v_post.venue_id) THEN
    RETURN app_private.feed_error('forbidden');
  END IF;
  IF NOT app_private.feed_post_is_publicly_visible(
    v_post.state, v_post.scheduled_for, v_post.published_at,
    v_post.archived_at, v_post.platform_quarantined_at
  ) THEN
    RETURN app_private.feed_error('conflict');
  END IF;

  PERFORM 1
  FROM public.feed_posts p
  WHERE p.venue_id = v_post.venue_id
    AND p.is_pinned
  FOR UPDATE;

  SELECT count(*)::integer INTO v_count
  FROM public.feed_posts p
  WHERE p.venue_id = v_post.venue_id
    AND p.is_pinned
    AND p.id <> p_post_id;

  IF v_count >= 3 THEN
    RETURN app_private.feed_error('conflict');
  END IF;

  IF v_post.is_pinned THEN
    RETURN pg_catalog.jsonb_build_object('ok', true, 'post_id', p_post_id);
  END IF;

  UPDATE public.feed_posts
  SET is_pinned = true,
      pinned_at = pg_catalog.now(),
      updated_by = app_private.current_user_id()
  WHERE id = p_post_id;

  PERFORM app_private.append_feed_event(
    p_post_id, v_post.venue_id, 'pinned', v_post.state, v_post.state
  );
  PERFORM app_private.write_feed_audit(
    'publish_content', v_post.business_id, v_post.venue_id, p_post_id,
    'Pinned feed post',
    pg_catalog.jsonb_build_object('pinned', false),
    pg_catalog.jsonb_build_object('pinned', true)
  );
  RETURN pg_catalog.jsonb_build_object('ok', true, 'post_id', p_post_id);
END;
$$;

CREATE FUNCTION public.unpin_feed_post(p_post_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_post public.feed_posts%ROWTYPE;
BEGIN
  IF app_private.current_user_id() IS NULL THEN
    RETURN app_private.feed_error('unauthenticated');
  END IF;
  SELECT * INTO v_post FROM public.feed_posts p WHERE p.id = p_post_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN app_private.feed_error('not_found');
  END IF;
  IF NOT app_private.may_publish_feed_post(v_post.venue_id) THEN
    RETURN app_private.feed_error('forbidden');
  END IF;

  IF NOT v_post.is_pinned THEN
    RETURN pg_catalog.jsonb_build_object('ok', true, 'post_id', p_post_id);
  END IF;

  UPDATE public.feed_posts
  SET is_pinned = false,
      pinned_at = NULL,
      updated_by = app_private.current_user_id()
  WHERE id = p_post_id;

  PERFORM app_private.append_feed_event(
    p_post_id, v_post.venue_id, 'unpinned', v_post.state, v_post.state
  );
  PERFORM app_private.write_feed_audit(
    'publish_content', v_post.business_id, v_post.venue_id, p_post_id,
    'Unpinned feed post',
    pg_catalog.jsonb_build_object('pinned', true),
    pg_catalog.jsonb_build_object('pinned', false)
  );
  RETURN pg_catalog.jsonb_build_object('ok', true, 'post_id', p_post_id);
END;
$$;

CREATE FUNCTION public.archive_feed_post(p_post_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_post public.feed_posts%ROWTYPE;
BEGIN
  IF app_private.current_user_id() IS NULL THEN
    RETURN app_private.feed_error('unauthenticated');
  END IF;
  SELECT * INTO v_post FROM public.feed_posts p WHERE p.id = p_post_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN app_private.feed_error('not_found');
  END IF;
  IF NOT app_private.may_publish_feed_post(v_post.venue_id) THEN
    RETURN app_private.feed_error('forbidden');
  END IF;
  IF v_post.state = 'archived' THEN
    RETURN pg_catalog.jsonb_build_object('ok', true, 'post_id', p_post_id);
  END IF;

  UPDATE public.feed_posts
  SET state = 'archived',
      archived_at = pg_catalog.now(),
      is_pinned = false,
      pinned_at = NULL,
      scheduled_for = NULL,
      updated_by = app_private.current_user_id()
  WHERE id = p_post_id;

  PERFORM app_private.append_feed_event(
    p_post_id, v_post.venue_id, 'archived', v_post.state, 'archived'
  );
  PERFORM app_private.write_feed_audit(
    'publish_content', v_post.business_id, v_post.venue_id, p_post_id,
    'Archived feed post',
    pg_catalog.jsonb_build_object('state', v_post.state),
    pg_catalog.jsonb_build_object('state', 'archived')
  );
  RETURN pg_catalog.jsonb_build_object('ok', true, 'post_id', p_post_id);
END;
$$;

CREATE FUNCTION public.restore_feed_post_to_draft(p_post_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_post public.feed_posts%ROWTYPE;
BEGIN
  IF app_private.current_user_id() IS NULL THEN
    RETURN app_private.feed_error('unauthenticated');
  END IF;
  SELECT * INTO v_post FROM public.feed_posts p WHERE p.id = p_post_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN app_private.feed_error('not_found');
  END IF;
  IF NOT app_private.may_publish_feed_post(v_post.venue_id) THEN
    RETURN app_private.feed_error('forbidden');
  END IF;
  IF v_post.state <> 'archived' THEN
    RETURN app_private.feed_error('conflict');
  END IF;

  UPDATE public.feed_posts
  SET state = 'draft',
      archived_at = NULL,
      scheduled_for = NULL,
      published_at = NULL,
      is_pinned = false,
      pinned_at = NULL,
      approved_at = NULL,
      approved_by = NULL,
      updated_by = app_private.current_user_id()
  WHERE id = p_post_id;

  PERFORM app_private.append_feed_event(
    p_post_id, v_post.venue_id, 'restored', 'archived', 'draft'
  );
  PERFORM app_private.write_feed_audit(
    'publish_content', v_post.business_id, v_post.venue_id, p_post_id,
    'Restored feed post to draft',
    pg_catalog.jsonb_build_object('state', 'archived'),
    pg_catalog.jsonb_build_object('state', 'draft')
  );
  RETURN pg_catalog.jsonb_build_object('ok', true, 'post_id', p_post_id);
END;
$$;

CREATE FUNCTION public.copy_feed_post_to_venue(
  p_post_id uuid,
  p_destination_venue_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := app_private.current_user_id();
  v_source public.feed_posts%ROWTYPE;
  v_dest public.venues%ROWTYPE;
  v_copy_id uuid := pg_catalog.gen_random_uuid();
  v_row public.feed_post_translations%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RETURN app_private.feed_error('unauthenticated');
  END IF;
  SELECT * INTO v_source FROM public.feed_posts p WHERE p.id = p_post_id FOR SHARE;
  IF NOT FOUND THEN
    RETURN app_private.feed_error('not_found');
  END IF;
  SELECT * INTO v_dest FROM public.venues v WHERE v.id = p_destination_venue_id;
  IF NOT FOUND THEN
    RETURN app_private.feed_error('not_found');
  END IF;
  IF p_destination_venue_id = v_source.venue_id THEN
    RETURN app_private.feed_error('invalid_payload');
  END IF;
  IF v_dest.business_id IS DISTINCT FROM v_source.business_id THEN
    RETURN app_private.feed_error('forbidden');
  END IF;
  IF NOT app_private.may_read_feed_admin(v_source.venue_id)
     OR NOT app_private.may_create_feed_post(p_destination_venue_id) THEN
    RETURN app_private.feed_error('forbidden');
  END IF;
  IF NOT app_private.feed_has_english(p_post_id) THEN
    RETURN app_private.feed_error('invalid_payload');
  END IF;

  INSERT INTO public.feed_posts (
    id, venue_id, business_id, post_type, state,
    source_post_id, source_venue_id, created_by, updated_by
  )
  VALUES (
    v_copy_id, p_destination_venue_id, v_dest.business_id, v_source.post_type,
    'draft', v_source.id, v_source.venue_id, v_actor, v_actor
  );

  FOR v_row IN
    SELECT * FROM public.feed_post_translations t WHERE t.post_id = p_post_id
  LOOP
    INSERT INTO public.feed_post_translations (
      post_id, venue_id, locale, title, body, updated_by
    )
    VALUES (
      v_copy_id, p_destination_venue_id, v_row.locale,
      v_row.title, v_row.body, v_actor
    );
  END LOOP;

  PERFORM app_private.append_feed_event(
    v_copy_id, p_destination_venue_id, 'copied', NULL, 'draft'
  );
  PERFORM app_private.write_feed_audit(
    'create_content', v_dest.business_id, p_destination_venue_id, v_copy_id,
    'Copied feed post as draft',
    pg_catalog.jsonb_build_object('source_post_id', p_post_id),
    pg_catalog.jsonb_build_object('state', 'draft')
  );

  RETURN pg_catalog.jsonb_build_object('ok', true, 'post_id', v_copy_id);
END;
$$;

CREATE FUNCTION public.update_feed_module_settings(
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
    RETURN app_private.feed_error('unauthenticated');
  END IF;
  IF p_venue_id IS NULL OR p_payload IS NULL
     OR jsonb_typeof(p_payload) <> 'object' THEN
    RETURN app_private.feed_error('invalid_payload');
  END IF;
  IF NOT app_private.has_tenant_action_on_venue(
       'manage_venue_module_visibility', p_venue_id
     )
     AND NOT app_private.platform_may_write_tenant(
       (SELECT v.business_id FROM public.venues v WHERE v.id = p_venue_id),
       p_venue_id
     ) THEN
    RETURN app_private.feed_error('forbidden');
  END IF;
  IF NOT app_private.subscription_allows_tenant_writes(p_venue_id) THEN
    RETURN app_private.feed_error('forbidden');
  END IF;
  IF NOT app_private.feed_module_entitled(p_venue_id) THEN
    RETURN app_private.feed_error('forbidden');
  END IF;

  v_settings := COALESCE(p_payload->'settings', '{}'::jsonb);
  IF NOT app_private.feed_settings_shape_ok(v_settings) THEN
    RETURN app_private.feed_error('invalid_payload');
  END IF;

  v_enabled := COALESCE((p_payload->>'is_enabled')::boolean, true);
  v_public := COALESCE((p_payload->>'is_publicly_visible')::boolean, true);
  v_heading_en := NULLIF(pg_catalog.btrim(COALESCE(p_payload->>'heading_en', '')), '');
  v_heading_th := NULLIF(pg_catalog.btrim(COALESCE(p_payload->>'heading_th', '')), '');

  INSERT INTO public.venue_module_settings (
    venue_id, module_key, is_enabled, is_publicly_visible, settings, updated_by
  )
  VALUES (
    p_venue_id, 'feed', v_enabled, v_public, v_settings, v_actor
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

CREATE FUNCTION public.list_public_venue_feed(
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
  v_horizon integer := 365;
  v_preview boolean := true;
  v_preview_count integer := 3;
  v_cursor jsonb;
  v_pin integer;
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

  IF NOT FOUND OR NOT app_private.feed_module_public(v_venue.id) THEN
    RETURN pg_catalog.jsonb_build_object('ok', true, 'available', false);
  END IF;

  SELECT s.settings INTO v_settings
  FROM public.venue_module_settings s
  WHERE s.venue_id = v_venue.id AND s.module_key = 'feed';

  v_horizon := LEAST(
    730,
    GREATEST(1, COALESCE((v_settings->>'horizon_days')::integer, 365))
  );
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
    AND s.module_key = 'feed'
    AND t.locale = v_locale;

  IF v_heading IS NULL THEN
    SELECT t.public_heading INTO v_heading
    FROM public.venue_module_setting_translations t
    JOIN public.venue_module_settings s
      ON s.id = t.venue_module_setting_id AND s.venue_id = t.venue_id
    WHERE s.venue_id = v_venue.id
      AND s.module_key = 'feed'
      AND t.locale = 'en';
  END IF;

  IF p_cursor IS NOT NULL AND pg_catalog.btrim(p_cursor) <> '' THEN
    BEGIN
      v_cursor := pg_catalog.convert_from(
        pg_catalog.decode(pg_catalog.replace(p_cursor, E'\n', ''), 'base64'),
        'UTF8'
      )::jsonb;
      v_pin := (v_cursor->>'p')::integer;
      v_ts := (v_cursor->>'t')::timestamptz;
      v_id := (v_cursor->>'i')::uuid;
      IF v_pin IS NULL OR v_ts IS NULL OR v_id IS NULL THEN
        v_cursor := NULL;
      END IF;
    EXCEPTION WHEN others THEN
      v_cursor := NULL;
      v_pin := NULL;
    END;
    IF v_cursor IS NULL THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok', true,
        'available', true,
        'heading', v_heading,
        'preview_enabled', v_preview,
        'preview_count', v_preview_count,
        'items', '[]'::jsonb,
        'next_cursor', NULL
      );
    END IF;
  END IF;

  WITH visible AS (
    SELECT
      p.id,
      p.post_type,
      p.is_pinned,
      COALESCE(p.published_at, p.scheduled_for) AS sort_at,
      COALESCE(
        (
          SELECT t.title
          FROM public.feed_post_translations t
          WHERE t.post_id = p.id AND t.locale = v_locale
        ),
        (
          SELECT t.title
          FROM public.feed_post_translations t
          WHERE t.post_id = p.id AND t.locale = 'en'
        )
      ) AS title,
      COALESCE(
        (
          SELECT t.body
          FROM public.feed_post_translations t
          WHERE t.post_id = p.id AND t.locale = v_locale
        ),
        (
          SELECT t.body
          FROM public.feed_post_translations t
          WHERE t.post_id = p.id AND t.locale = 'en'
        )
      ) AS body,
      CASE
        WHEN EXISTS (
          SELECT 1 FROM public.feed_post_translations t
          WHERE t.post_id = p.id AND t.locale = v_locale
        ) THEN v_locale
        ELSE 'en'
      END AS locale
    FROM public.feed_posts p
    WHERE p.venue_id = v_venue.id
      AND app_private.feed_post_is_publicly_visible(
        p.state, p.scheduled_for, p.published_at,
        p.archived_at, p.platform_quarantined_at
      )
      AND COALESCE(p.published_at, p.scheduled_for)
        >= pg_catalog.now() - (v_horizon || ' days')::interval
      AND EXISTS (
        SELECT 1 FROM public.feed_post_translations t
        WHERE t.post_id = p.id AND t.locale = 'en'
      )
  ),
  ranked AS (
    SELECT
      v.*,
      row_number() OVER (
        ORDER BY v.is_pinned DESC, v.sort_at DESC, v.id DESC
      ) AS rn
    FROM visible v
    WHERE v_pin IS NULL
       OR (
         (CASE WHEN v.is_pinned THEN 1 ELSE 0 END) < v_pin
         OR (
           (CASE WHEN v.is_pinned THEN 1 ELSE 0 END) = v_pin
           AND v.sort_at < v_ts
         )
         OR (
           (CASE WHEN v.is_pinned THEN 1 ELSE 0 END) = v_pin
           AND v.sort_at = v_ts
           AND v.id < v_id
         )
       )
  )
  SELECT
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'title', r.title,
          'body', r.body,
          'post_type', r.post_type,
          'published_at', r.sort_at,
          'is_pinned', r.is_pinned,
          'locale', r.locale
        )
        ORDER BY r.rn
      ) FILTER (WHERE r.rn <= v_limit),
      '[]'::jsonb
    ),
    CASE
      WHEN max(r.rn) FILTER (WHERE r.rn = v_limit + 1) IS NOT NULL THEN
        (
          SELECT app_private.feed_encode_cursor(
            x.is_pinned,
            x.sort_at,
            x.id
          )
          FROM ranked x
          WHERE x.rn = v_limit
        )
      ELSE NULL
    END
  INTO v_items, v_next
  FROM ranked r;

  RETURN pg_catalog.jsonb_build_object(
    'ok', true,
    'available', true,
    'heading', v_heading,
    'preview_enabled', v_preview,
    'preview_count', v_preview_count,
    'items', COALESCE(v_items, '[]'::jsonb),
    'next_cursor', v_next
  );
END;
$$;

REVOKE ALL ON FUNCTION app_private.feed_error(text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.upsert_feed_translation(
  uuid, uuid, text, text, text, uuid
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.feed_has_english(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.feed_write_translations(
  uuid, uuid, jsonb, uuid
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.feed_encode_cursor(boolean, timestamptz, uuid)
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.create_feed_post(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_feed_post_draft(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_feed_post_for_approval(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_feed_post(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reject_feed_post(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.publish_feed_post_now(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.schedule_feed_post_publication(uuid, timestamptz)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.unpublish_feed_post(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pin_feed_post(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.unpin_feed_post(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.archive_feed_post(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.restore_feed_post_to_draft(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.copy_feed_post_to_venue(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_feed_module_settings(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_public_venue_feed(text, text, integer, text)
  FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_feed_post(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_feed_post_draft(uuid, jsonb)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_feed_post_for_approval(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_feed_post(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_feed_post(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_feed_post_now(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_feed_post_publication(uuid, timestamptz)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.unpublish_feed_post(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pin_feed_post(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unpin_feed_post(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_feed_post(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_feed_post_to_draft(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.copy_feed_post_to_venue(uuid, uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_feed_module_settings(uuid, jsonb)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_public_venue_feed(text, text, integer, text)
  TO anon, authenticated;
