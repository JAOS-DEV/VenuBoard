-- Event write and public-read RPCs. Codes only. search_path is empty.

CREATE FUNCTION app_private.upsert_event_translation(
  p_event_id uuid,
  p_venue_id uuid,
  p_locale text,
  p_title text,
  p_summary text,
  p_description text,
  p_cta_label text,
  p_actor uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_title text;
  v_summary text;
  v_description text;
  v_cta text;
BEGIN
  IF p_locale IS NULL OR p_locale NOT IN ('en', 'th') THEN
    RETURN;
  END IF;

  v_title := NULLIF(pg_catalog.btrim(COALESCE(p_title, '')), '');
  v_summary := NULLIF(pg_catalog.btrim(COALESCE(p_summary, '')), '');
  v_description := NULLIF(pg_catalog.btrim(COALESCE(p_description, '')), '');
  v_cta := NULLIF(pg_catalog.btrim(COALESCE(p_cta_label, '')), '');

  IF v_title IS NULL THEN
    DELETE FROM public.event_translations t
    WHERE t.event_id = p_event_id
      AND t.locale = p_locale;
    RETURN;
  END IF;

  INSERT INTO public.event_translations (
    event_id, venue_id, locale, title, summary, description, cta_label, updated_by
  )
  VALUES (
    p_event_id, p_venue_id, p_locale, v_title, v_summary, v_description, v_cta, p_actor
  )
  ON CONFLICT (event_id, locale)
  DO UPDATE SET
    title = EXCLUDED.title,
    summary = EXCLUDED.summary,
    description = EXCLUDED.description,
    cta_label = EXCLUDED.cta_label,
    updated_by = EXCLUDED.updated_by,
    updated_at = pg_catalog.now();
END;
$$;

CREATE FUNCTION app_private.event_error(p_code text)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT pg_catalog.jsonb_build_object('ok', false, 'code', p_code);
$$;

CREATE FUNCTION public.create_event(p_venue_id uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := app_private.current_user_id();
  v_venue public.venues%ROWTYPE;
  v_event_id uuid := pg_catalog.gen_random_uuid();
  v_timezone text;
  v_starts timestamptz;
  v_ends timestamptz;
  v_title_en text;
BEGIN
  IF v_actor IS NULL THEN
    RETURN app_private.event_error('unauthenticated');
  END IF;
  IF p_venue_id IS NULL OR p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RETURN app_private.event_error('invalid_payload');
  END IF;
  IF NOT app_private.may_create_event(p_venue_id) THEN
    RETURN app_private.event_error('forbidden');
  END IF;

  SELECT * INTO v_venue FROM public.venues v WHERE v.id = p_venue_id;
  IF NOT FOUND THEN
    RETURN app_private.event_error('not_found');
  END IF;

  v_timezone := pg_catalog.btrim(COALESCE(p_payload->>'timezone', v_venue.timezone));
  IF NOT app_private.is_supported_timezone(v_timezone) THEN
    RETURN app_private.event_error('invalid_payload');
  END IF;

  BEGIN
    v_starts := (p_payload->>'starts_at')::timestamptz;
    v_ends := (p_payload->>'ends_at')::timestamptz;
  EXCEPTION WHEN others THEN
    RETURN app_private.event_error('invalid_payload');
  END;

  IF v_starts IS NULL OR v_ends IS NULL OR v_ends <= v_starts
     OR v_ends > v_starts + interval '7 days' THEN
    RETURN app_private.event_error('invalid_payload');
  END IF;

  v_title_en := NULLIF(pg_catalog.btrim(COALESCE(p_payload->>'title_en', '')), '');
  IF v_title_en IS NULL THEN
    RETURN app_private.event_error('invalid_payload');
  END IF;

  INSERT INTO public.events (
    id, venue_id, business_id, starts_at, ends_at, timezone, is_all_day,
    state, approval_status, created_by, updated_by
  )
  VALUES (
    v_event_id, p_venue_id, v_venue.business_id, v_starts, v_ends, v_timezone,
    COALESCE((p_payload->>'is_all_day')::boolean, false),
    'draft', 'not_submitted', v_actor, v_actor
  );

  PERFORM app_private.upsert_event_translation(
    v_event_id, p_venue_id, 'en',
    p_payload->>'title_en', p_payload->>'summary_en',
    p_payload->>'description_en', p_payload->>'cta_label_en', v_actor
  );
  PERFORM app_private.upsert_event_translation(
    v_event_id, p_venue_id, 'th',
    p_payload->>'title_th', p_payload->>'summary_th',
    p_payload->>'description_th', p_payload->>'cta_label_th', v_actor
  );

  IF NOT EXISTS (
    SELECT 1 FROM public.event_translations t
    WHERE t.event_id = v_event_id AND t.locale = 'en'
  ) THEN
    RETURN app_private.event_error('invalid_payload');
  END IF;

  PERFORM app_private.append_event_workflow(
    v_event_id, p_venue_id, 'create', NULL, 'draft', NULL, 'not_submitted'
  );
  PERFORM app_private.write_event_audit(
    'create_content', v_venue.business_id, p_venue_id, v_event_id,
    'Created event draft',
    '{}'::jsonb,
    pg_catalog.jsonb_build_object('state', 'draft', 'approval_status', 'not_submitted')
  );

  RETURN pg_catalog.jsonb_build_object('ok', true, 'event_id', v_event_id);
END;
$$;

CREATE FUNCTION public.update_event_draft(p_event_id uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := app_private.current_user_id();
  v_event public.events%ROWTYPE;
  v_starts timestamptz;
  v_ends timestamptz;
  v_timezone text;
BEGIN
  IF v_actor IS NULL THEN
    RETURN app_private.event_error('unauthenticated');
  END IF;
  IF p_event_id IS NULL OR p_payload IS NULL THEN
    RETURN app_private.event_error('invalid_payload');
  END IF;

  SELECT * INTO v_event FROM public.events e WHERE e.id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN app_private.event_error('not_found');
  END IF;
  IF NOT app_private.may_edit_event_draft(v_event.venue_id) THEN
    RETURN app_private.event_error('forbidden');
  END IF;
  IF v_event.state NOT IN ('draft') OR v_event.approval_status = 'pending' THEN
    RETURN app_private.event_error('conflict');
  END IF;
  IF v_event.platform_quarantined_at IS NOT NULL THEN
    RETURN app_private.event_error('forbidden');
  END IF;

  BEGIN
    v_starts := COALESCE((p_payload->>'starts_at')::timestamptz, v_event.starts_at);
    v_ends := COALESCE((p_payload->>'ends_at')::timestamptz, v_event.ends_at);
  EXCEPTION WHEN others THEN
    RETURN app_private.event_error('invalid_payload');
  END;

  v_timezone := pg_catalog.btrim(COALESCE(p_payload->>'timezone', v_event.timezone));
  IF NOT app_private.is_supported_timezone(v_timezone)
     OR v_ends <= v_starts
     OR v_ends > v_starts + interval '7 days' THEN
    RETURN app_private.event_error('invalid_payload');
  END IF;

  UPDATE public.events e
  SET
    starts_at = v_starts,
    ends_at = v_ends,
    timezone = v_timezone,
    is_all_day = COALESCE((p_payload->>'is_all_day')::boolean, e.is_all_day),
    approval_status = CASE
      WHEN e.approval_status = 'rejected' THEN 'not_submitted'
      ELSE e.approval_status
    END,
    rejection_reason = CASE
      WHEN e.approval_status = 'rejected' THEN NULL
      ELSE e.rejection_reason
    END,
    updated_by = v_actor
  WHERE e.id = p_event_id;

  IF p_payload ? 'title_en' OR p_payload ? 'summary_en'
     OR p_payload ? 'description_en' OR p_payload ? 'cta_label_en' THEN
    PERFORM app_private.upsert_event_translation(
      p_event_id, v_event.venue_id, 'en',
      COALESCE(p_payload->>'title_en', (
        SELECT t.title FROM public.event_translations t
        WHERE t.event_id = p_event_id AND t.locale = 'en'
      )),
      COALESCE(p_payload->>'summary_en', (
        SELECT t.summary FROM public.event_translations t
        WHERE t.event_id = p_event_id AND t.locale = 'en'
      )),
      COALESCE(p_payload->>'description_en', (
        SELECT t.description FROM public.event_translations t
        WHERE t.event_id = p_event_id AND t.locale = 'en'
      )),
      COALESCE(p_payload->>'cta_label_en', (
        SELECT t.cta_label FROM public.event_translations t
        WHERE t.event_id = p_event_id AND t.locale = 'en'
      )),
      v_actor
    );
  END IF;

  IF p_payload ? 'title_th' OR p_payload ? 'summary_th'
     OR p_payload ? 'description_th' OR p_payload ? 'cta_label_th' THEN
    PERFORM app_private.upsert_event_translation(
      p_event_id, v_event.venue_id, 'th',
      p_payload->>'title_th', p_payload->>'summary_th',
      p_payload->>'description_th', p_payload->>'cta_label_th', v_actor
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.event_translations t
    WHERE t.event_id = p_event_id AND t.locale = 'en'
  ) THEN
    RETURN app_private.event_error('invalid_payload');
  END IF;

  PERFORM app_private.write_event_audit(
    'create_content', v_event.business_id, v_event.venue_id, p_event_id,
    'Updated event draft',
    pg_catalog.jsonb_build_object('state', v_event.state),
    pg_catalog.jsonb_build_object('state', 'draft')
  );

  RETURN pg_catalog.jsonb_build_object('ok', true, 'event_id', p_event_id);
END;
$$;

CREATE FUNCTION public.submit_event_for_approval(p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_event public.events%ROWTYPE;
BEGIN
  IF app_private.current_user_id() IS NULL THEN
    RETURN app_private.event_error('unauthenticated');
  END IF;
  SELECT * INTO v_event FROM public.events e WHERE e.id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN app_private.event_error('not_found');
  END IF;
  IF NOT app_private.may_submit_event(v_event.venue_id) THEN
    RETURN app_private.event_error('forbidden');
  END IF;
  IF v_event.state <> 'draft' OR v_event.approval_status = 'pending' THEN
    RETURN app_private.event_error('conflict');
  END IF;

  UPDATE public.events
  SET approval_status = 'pending', rejection_reason = NULL,
      updated_by = app_private.current_user_id()
  WHERE id = p_event_id;

  PERFORM app_private.append_event_workflow(
    p_event_id, v_event.venue_id, 'submit',
    'draft', 'draft', v_event.approval_status, 'pending'
  );
  PERFORM app_private.write_event_audit(
    'submit_content_for_approval', v_event.business_id, v_event.venue_id,
    p_event_id, 'Submitted event for approval',
    pg_catalog.jsonb_build_object('approval_status', v_event.approval_status),
    pg_catalog.jsonb_build_object('approval_status', 'pending')
  );
  RETURN pg_catalog.jsonb_build_object('ok', true, 'event_id', p_event_id);
END;
$$;

CREATE FUNCTION public.approve_event(p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_event public.events%ROWTYPE;
BEGIN
  IF app_private.current_user_id() IS NULL THEN
    RETURN app_private.event_error('unauthenticated');
  END IF;
  SELECT * INTO v_event FROM public.events e WHERE e.id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN app_private.event_error('not_found');
  END IF;
  IF NOT app_private.may_approve_event(v_event.venue_id) THEN
    RETURN app_private.event_error('forbidden');
  END IF;
  IF v_event.approval_status <> 'pending' OR v_event.state <> 'draft' THEN
    RETURN app_private.event_error('conflict');
  END IF;

  UPDATE public.events
  SET approval_status = 'approved', rejection_reason = NULL,
      updated_by = app_private.current_user_id()
  WHERE id = p_event_id;

  PERFORM app_private.append_event_workflow(
    p_event_id, v_event.venue_id, 'approve', 'draft', 'draft', 'pending', 'approved'
  );
  PERFORM app_private.write_event_audit(
    'approve_content', v_event.business_id, v_event.venue_id, p_event_id,
    'Approved event',
    pg_catalog.jsonb_build_object('approval_status', 'pending'),
    pg_catalog.jsonb_build_object('approval_status', 'approved')
  );
  RETURN pg_catalog.jsonb_build_object('ok', true, 'event_id', p_event_id);
END;
$$;

CREATE FUNCTION public.reject_event(p_event_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_event public.events%ROWTYPE;
  v_reason text;
BEGIN
  IF app_private.current_user_id() IS NULL THEN
    RETURN app_private.event_error('unauthenticated');
  END IF;
  v_reason := NULLIF(pg_catalog.btrim(COALESCE(p_reason, '')), '');
  IF v_reason IS NULL OR pg_catalog.char_length(v_reason) > 500 THEN
    RETURN app_private.event_error('invalid_payload');
  END IF;
  SELECT * INTO v_event FROM public.events e WHERE e.id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN app_private.event_error('not_found');
  END IF;
  IF NOT app_private.may_approve_event(v_event.venue_id) THEN
    RETURN app_private.event_error('forbidden');
  END IF;
  IF v_event.approval_status <> 'pending' THEN
    RETURN app_private.event_error('conflict');
  END IF;

  UPDATE public.events
  SET approval_status = 'rejected', rejection_reason = v_reason, state = 'draft',
      updated_by = app_private.current_user_id()
  WHERE id = p_event_id;

  PERFORM app_private.append_event_workflow(
    p_event_id, v_event.venue_id, 'reject', v_event.state, 'draft', 'pending', 'rejected'
  );
  PERFORM app_private.write_event_audit(
    'approve_content', v_event.business_id, v_event.venue_id, p_event_id,
    'Rejected event',
    pg_catalog.jsonb_build_object('approval_status', 'pending'),
    pg_catalog.jsonb_build_object('approval_status', 'rejected')
  );
  RETURN pg_catalog.jsonb_build_object('ok', true, 'event_id', p_event_id);
END;
$$;

CREATE FUNCTION public.publish_event_now(p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_event public.events%ROWTYPE;
  v_now timestamptz := pg_catalog.now();
BEGIN
  IF app_private.current_user_id() IS NULL THEN
    RETURN app_private.event_error('unauthenticated');
  END IF;
  SELECT * INTO v_event FROM public.events e WHERE e.id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN app_private.event_error('not_found');
  END IF;
  IF NOT app_private.may_publish_event(v_event.venue_id) THEN
    RETURN app_private.event_error('forbidden');
  END IF;
  IF v_event.platform_quarantined_at IS NOT NULL THEN
    RETURN app_private.event_error('forbidden');
  END IF;
  IF v_event.state NOT IN ('draft', 'scheduled') THEN
    RETURN app_private.event_error('conflict');
  END IF;
  IF v_event.approval_status = 'pending' THEN
    RETURN app_private.event_error('conflict');
  END IF;
  IF v_event.approval_status = 'rejected' THEN
    RETURN app_private.event_error('forbidden');
  END IF;

  IF app_private.events_require_manager_approval(v_event.venue_id) THEN
    IF v_event.approval_status <> 'approved' THEN
      RETURN app_private.event_error('forbidden');
    END IF;
  ELSE
    IF v_event.approval_status NOT IN ('not_submitted', 'approved') THEN
      RETURN app_private.event_error('forbidden');
    END IF;
  END IF;

  UPDATE public.events
  SET state = 'published',
      approval_status = 'approved',
      publish_at = v_now,
      published_at = v_now,
      rejection_reason = NULL,
      updated_by = app_private.current_user_id()
  WHERE id = p_event_id;

  PERFORM app_private.append_event_workflow(
    p_event_id, v_event.venue_id, 'publish',
    v_event.state, 'published', v_event.approval_status, 'approved'
  );
  PERFORM app_private.write_event_audit(
    'publish_content', v_event.business_id, v_event.venue_id, p_event_id,
    'Published event',
    pg_catalog.jsonb_build_object('state', v_event.state),
    pg_catalog.jsonb_build_object('state', 'published')
  );
  RETURN pg_catalog.jsonb_build_object('ok', true, 'event_id', p_event_id);
END;
$$;

CREATE FUNCTION public.schedule_event_publication(
  p_event_id uuid,
  p_publish_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_event public.events%ROWTYPE;
BEGIN
  IF app_private.current_user_id() IS NULL THEN
    RETURN app_private.event_error('unauthenticated');
  END IF;
  IF p_publish_at IS NULL OR p_publish_at <= pg_catalog.now() THEN
    RETURN app_private.event_error('invalid_payload');
  END IF;
  SELECT * INTO v_event FROM public.events e WHERE e.id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN app_private.event_error('not_found');
  END IF;
  IF NOT app_private.may_publish_event(v_event.venue_id) THEN
    RETURN app_private.event_error('forbidden');
  END IF;
  IF v_event.platform_quarantined_at IS NOT NULL THEN
    RETURN app_private.event_error('forbidden');
  END IF;
  IF v_event.state NOT IN ('draft', 'scheduled') OR v_event.approval_status = 'pending' THEN
    RETURN app_private.event_error('conflict');
  END IF;
  IF v_event.approval_status = 'rejected' THEN
    RETURN app_private.event_error('forbidden');
  END IF;

  IF app_private.events_require_manager_approval(v_event.venue_id) THEN
    IF v_event.approval_status <> 'approved' THEN
      RETURN app_private.event_error('forbidden');
    END IF;
  ELSE
    IF v_event.approval_status NOT IN ('not_submitted', 'approved') THEN
      RETURN app_private.event_error('forbidden');
    END IF;
  END IF;

  UPDATE public.events
  SET state = 'scheduled',
      approval_status = 'approved',
      publish_at = p_publish_at,
      published_at = NULL,
      updated_by = app_private.current_user_id()
  WHERE id = p_event_id;

  PERFORM app_private.append_event_workflow(
    p_event_id, v_event.venue_id, 'schedule',
    v_event.state, 'scheduled', v_event.approval_status, 'approved'
  );
  PERFORM app_private.write_event_audit(
    'manage_events', v_event.business_id, v_event.venue_id, p_event_id,
    'Scheduled event publication',
    pg_catalog.jsonb_build_object('state', v_event.state),
    pg_catalog.jsonb_build_object('state', 'scheduled')
  );
  RETURN pg_catalog.jsonb_build_object('ok', true, 'event_id', p_event_id);
END;
$$;

CREATE FUNCTION public.cancel_event(p_event_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_event public.events%ROWTYPE;
  v_reason text;
BEGIN
  IF app_private.current_user_id() IS NULL THEN
    RETURN app_private.event_error('unauthenticated');
  END IF;
  v_reason := NULLIF(pg_catalog.btrim(COALESCE(p_reason, '')), '');
  SELECT * INTO v_event FROM public.events e WHERE e.id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN app_private.event_error('not_found');
  END IF;
  IF NOT app_private.may_manage_event_lifecycle(v_event.venue_id) THEN
    RETURN app_private.event_error('forbidden');
  END IF;
  IF v_event.state IN ('cancelled', 'archived') THEN
    RETURN app_private.event_error('conflict');
  END IF;

  UPDATE public.events
  SET state = 'cancelled',
      cancelled_at = pg_catalog.now(),
      cancellation_reason = v_reason,
      updated_by = app_private.current_user_id()
  WHERE id = p_event_id;

  PERFORM app_private.append_event_workflow(
    p_event_id, v_event.venue_id, 'cancel',
    v_event.state, 'cancelled', v_event.approval_status, v_event.approval_status
  );
  PERFORM app_private.write_event_audit(
    'manage_events', v_event.business_id, v_event.venue_id, p_event_id,
    'Cancelled event',
    pg_catalog.jsonb_build_object('state', v_event.state),
    pg_catalog.jsonb_build_object('state', 'cancelled')
  );
  RETURN pg_catalog.jsonb_build_object('ok', true, 'event_id', p_event_id);
END;
$$;

CREATE FUNCTION public.archive_event(p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_event public.events%ROWTYPE;
BEGIN
  IF app_private.current_user_id() IS NULL THEN
    RETURN app_private.event_error('unauthenticated');
  END IF;
  SELECT * INTO v_event FROM public.events e WHERE e.id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN app_private.event_error('not_found');
  END IF;
  IF NOT app_private.may_manage_event_lifecycle(v_event.venue_id) THEN
    RETURN app_private.event_error('forbidden');
  END IF;
  IF v_event.state = 'archived' THEN
    RETURN app_private.event_error('conflict');
  END IF;

  UPDATE public.events
  SET state = 'archived',
      archived_at = pg_catalog.now(),
      cancelled_at = NULL,
      updated_by = app_private.current_user_id()
  WHERE id = p_event_id;

  PERFORM app_private.append_event_workflow(
    p_event_id, v_event.venue_id, 'archive',
    v_event.state, 'archived', v_event.approval_status, v_event.approval_status
  );
  PERFORM app_private.write_event_audit(
    'publish_content', v_event.business_id, v_event.venue_id, p_event_id,
    'Archived event',
    pg_catalog.jsonb_build_object('state', v_event.state),
    pg_catalog.jsonb_build_object('state', 'archived')
  );
  RETURN pg_catalog.jsonb_build_object('ok', true, 'event_id', p_event_id);
END;
$$;

CREATE FUNCTION public.restore_event_to_draft(p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_event public.events%ROWTYPE;
BEGIN
  IF app_private.current_user_id() IS NULL THEN
    RETURN app_private.event_error('unauthenticated');
  END IF;
  SELECT * INTO v_event FROM public.events e WHERE e.id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN app_private.event_error('not_found');
  END IF;
  IF NOT app_private.may_manage_event_lifecycle(v_event.venue_id) THEN
    RETURN app_private.event_error('forbidden');
  END IF;
  IF v_event.state NOT IN ('cancelled', 'archived') THEN
    RETURN app_private.event_error('conflict');
  END IF;
  IF v_event.platform_quarantined_at IS NOT NULL THEN
    RETURN app_private.event_error('forbidden');
  END IF;

  UPDATE public.events
  SET state = 'draft',
      approval_status = 'not_submitted',
      publish_at = NULL,
      published_at = NULL,
      cancelled_at = NULL,
      archived_at = NULL,
      updated_by = app_private.current_user_id()
  WHERE id = p_event_id;

  PERFORM app_private.append_event_workflow(
    p_event_id, v_event.venue_id, 'restore',
    v_event.state, 'draft', v_event.approval_status, 'not_submitted'
  );
  PERFORM app_private.write_event_audit(
    'manage_events', v_event.business_id, v_event.venue_id, p_event_id,
    'Restored event to draft',
    pg_catalog.jsonb_build_object('state', v_event.state),
    pg_catalog.jsonb_build_object('state', 'draft')
  );
  RETURN pg_catalog.jsonb_build_object('ok', true, 'event_id', p_event_id);
END;
$$;

CREATE FUNCTION public.copy_event_to_venue(
  p_event_id uuid,
  p_destination_venue_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := app_private.current_user_id();
  v_source public.events%ROWTYPE;
  v_dest public.venues%ROWTYPE;
  v_copy_id uuid := pg_catalog.gen_random_uuid();
  v_row public.event_translations%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RETURN app_private.event_error('unauthenticated');
  END IF;
  SELECT * INTO v_source FROM public.events e WHERE e.id = p_event_id FOR SHARE;
  IF NOT FOUND THEN
    RETURN app_private.event_error('not_found');
  END IF;
  SELECT * INTO v_dest FROM public.venues v WHERE v.id = p_destination_venue_id;
  IF NOT FOUND THEN
    RETURN app_private.event_error('not_found');
  END IF;
  IF p_destination_venue_id = v_source.venue_id THEN
    RETURN app_private.event_error('invalid_payload');
  END IF;
  IF v_dest.business_id IS DISTINCT FROM v_source.business_id THEN
    RETURN app_private.event_error('forbidden');
  END IF;
  IF NOT app_private.may_read_event_admin(v_source.venue_id)
     OR NOT app_private.may_create_event(p_destination_venue_id) THEN
    RETURN app_private.event_error('forbidden');
  END IF;

  -- MVP requires an English title. If the source event is missing EN,
  -- stop here so the copy does not produce a partially-invalid record.
  IF NOT EXISTS (
    SELECT 1
    FROM public.event_translations t
    WHERE t.event_id = p_event_id
      AND t.locale = 'en'
  ) THEN
    RETURN app_private.event_error('invalid_payload');
  END IF;

  INSERT INTO public.events (
    id, venue_id, business_id, starts_at, ends_at, timezone, is_all_day,
    state, approval_status, source_event_id, source_venue_id,
    created_by, updated_by
  )
  VALUES (
    v_copy_id, p_destination_venue_id, v_dest.business_id,
    v_source.starts_at, v_source.ends_at, v_dest.timezone, v_source.is_all_day,
    'draft', 'not_submitted', v_source.id, v_source.venue_id, v_actor, v_actor
  );

  FOR v_row IN
    SELECT * FROM public.event_translations t WHERE t.event_id = p_event_id
  LOOP
    INSERT INTO public.event_translations (
      event_id, venue_id, locale, title, summary, description, cta_label, updated_by
    )
    VALUES (
      v_copy_id, p_destination_venue_id, v_row.locale,
      v_row.title, v_row.summary, v_row.description, v_row.cta_label, v_actor
    );
  END LOOP;

  PERFORM app_private.append_event_workflow(
    v_copy_id, p_destination_venue_id, 'copy', NULL, 'draft', NULL, 'not_submitted'
  );
  PERFORM app_private.write_event_audit(
    'manage_events', v_dest.business_id, p_destination_venue_id, v_copy_id,
    'Copied event as draft',
    pg_catalog.jsonb_build_object('source_event_id', p_event_id),
    pg_catalog.jsonb_build_object('state', 'draft')
  );

  RETURN pg_catalog.jsonb_build_object('ok', true, 'event_id', v_copy_id);
END;
$$;

CREATE FUNCTION public.update_events_module_settings(
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
    RETURN app_private.event_error('unauthenticated');
  END IF;
  IF NOT app_private.has_tenant_action_on_venue('manage_venue_module_visibility', p_venue_id)
     OR NOT app_private.subscription_allows_tenant_writes(p_venue_id) THEN
    RETURN app_private.event_error('forbidden');
  END IF;
  IF NOT app_private.events_module_entitled(p_venue_id) THEN
    RETURN app_private.event_error('forbidden');
  END IF;

  v_settings := COALESCE(p_payload->'settings', '{}'::jsonb);
  IF NOT app_private.events_settings_shape_ok(v_settings) THEN
    RETURN app_private.event_error('invalid_payload');
  END IF;

  INSERT INTO public.venue_module_settings (
    venue_id, module_key, is_enabled, is_publicly_visible, settings, updated_by
  )
  VALUES (
    p_venue_id, 'events',
    COALESCE((p_payload->>'is_enabled')::boolean, true),
    COALESCE((p_payload->>'is_publicly_visible')::boolean, true),
    v_settings, v_actor
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
    DO UPDATE SET public_heading = EXCLUDED.public_heading, updated_by = EXCLUDED.updated_by;
  END IF;
  IF v_heading_th IS NOT NULL THEN
    INSERT INTO public.venue_module_setting_translations (
      venue_module_setting_id, venue_id, locale, public_heading, updated_by
    )
    VALUES (v_setting_id, p_venue_id, 'th', v_heading_th, v_actor)
    ON CONFLICT (venue_module_setting_id, locale)
    DO UPDATE SET public_heading = EXCLUDED.public_heading, updated_by = EXCLUDED.updated_by;
  END IF;

  RETURN pg_catalog.jsonb_build_object('ok', true);
END;
$$;

CREATE FUNCTION public.list_public_venue_events(
  p_venue_slug text,
  p_locale text DEFAULT 'en',
  p_view text DEFAULT 'upcoming',
  p_month text DEFAULT NULL,
  p_limit integer DEFAULT 24,
  p_offset integer DEFAULT 0
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
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 24), 1), 48);
  v_offset integer := GREATEST(COALESCE(p_offset, 0), 0);
  v_settings jsonb := '{}'::jsonb;
  v_heading text;
  v_horizon integer := 90;
  v_max integer := 24;
  v_show_archive boolean := false;
  v_order text := 'starts_at_asc';
  v_month_start timestamptz;
  v_month_end timestamptz;
  v_items jsonb := '[]'::jsonb;
  v_total integer := 0;
BEGIN
  IF p_venue_slug IS NULL OR pg_catalog.btrim(p_venue_slug) = '' THEN
    RETURN pg_catalog.jsonb_build_object('ok', true, 'available', false);
  END IF;

  SELECT * INTO v_venue
  FROM public.venues v
  WHERE v.slug = p_venue_slug;

  IF NOT FOUND OR NOT app_private.events_module_public(v_venue.id) THEN
    RETURN pg_catalog.jsonb_build_object('ok', true, 'available', false);
  END IF;

  SELECT s.settings INTO v_settings
  FROM public.venue_module_settings s
  WHERE s.venue_id = v_venue.id AND s.module_key = 'events';

  v_horizon := LEAST(366, GREATEST(1, COALESCE((v_settings->>'horizon_days')::integer, 90)));
  v_max := LEAST(48, GREATEST(1, COALESCE((v_settings->>'max_upcoming')::integer, 24)));
  v_show_archive := COALESCE((v_settings->>'show_past_archive')::boolean, false);
  v_order := COALESCE(v_settings->>'event_order', 'starts_at_asc');
  v_limit := LEAST(v_limit, v_max);

  SELECT t.public_heading INTO v_heading
  FROM public.venue_module_setting_translations t
  JOIN public.venue_module_settings s
    ON s.id = t.venue_module_setting_id AND s.venue_id = t.venue_id
  WHERE s.venue_id = v_venue.id
    AND s.module_key = 'events'
    AND t.locale = v_locale;

  IF v_heading IS NULL THEN
    SELECT t.public_heading INTO v_heading
    FROM public.venue_module_setting_translations t
    JOIN public.venue_module_settings s
      ON s.id = t.venue_module_setting_id AND s.venue_id = t.venue_id
    WHERE s.venue_id = v_venue.id
      AND s.module_key = 'events'
      AND t.locale = 'en';
  END IF;

  IF p_view = 'month' AND p_month ~ '^[0-9]{4}-[0-9]{2}$' THEN
    v_month_start := (p_month || '-01')::timestamp AT TIME ZONE v_venue.timezone;
    v_month_end := v_month_start + interval '1 month';
  END IF;

  WITH visible AS (
    SELECT e.*
    FROM public.events e
    WHERE e.venue_id = v_venue.id
      AND app_private.event_is_publicly_visible(
        e.state, e.approval_status, e.publish_at,
        e.cancelled_at, e.archived_at, e.platform_quarantined_at
      )
      AND (
        (p_view = 'archive' AND v_show_archive AND e.ends_at <= pg_catalog.now())
        OR (
          p_view = 'upcoming'
          AND e.ends_at > pg_catalog.now()
          AND e.starts_at <= pg_catalog.now() + (v_horizon || ' days')::interval
        )
        OR (
          p_view = 'month'
          AND v_month_start IS NOT NULL
          AND e.starts_at < v_month_end
          AND e.ends_at > v_month_start
          AND e.starts_at <= pg_catalog.now() + (v_horizon || ' days')::interval
        )
      )
  ),
  counted AS (
    SELECT count(*)::integer AS total FROM visible
  ),
  page AS (
    SELECT v.*
    FROM visible v
    ORDER BY
      CASE WHEN v_order = 'starts_at_desc' THEN v.starts_at END DESC,
      CASE WHEN v_order <> 'starts_at_desc' THEN v.starts_at END ASC,
      v.id
    LIMIT v_limit
    OFFSET v_offset
  )
  SELECT
    c.total,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'starts_at', p.starts_at,
          'ends_at', p.ends_at,
          'timezone', p.timezone,
          'is_all_day', p.is_all_day,
          'title', COALESCE(tr.title, en.title),
          'summary', COALESCE(tr.summary, en.summary),
          'description', COALESCE(tr.description, en.description),
          'cta_label', COALESCE(tr.cta_label, en.cta_label),
          'locale', CASE WHEN tr.title IS NOT NULL THEN v_locale ELSE 'en' END
        )
        ORDER BY p.starts_at, p.id
      ),
      '[]'::jsonb
    )
  INTO v_total, v_items
  FROM counted c
  LEFT JOIN page p ON true
  LEFT JOIN public.event_translations en
    ON en.event_id = p.id AND en.locale = 'en'
  LEFT JOIN public.event_translations tr
    ON tr.event_id = p.id AND tr.locale = v_locale
  GROUP BY c.total;

  RETURN pg_catalog.jsonb_build_object(
    'ok', true,
    'available', true,
    'heading', v_heading,
    'locale', v_locale,
    'timezone', v_venue.timezone,
    'view', p_view,
    'default_display', COALESCE(v_settings->>'default_display', 'calendar_and_list'),
    'horizon_days', v_horizon,
    'max_upcoming', v_max,
    'event_order', v_order,
    'show_past_archive', v_show_archive,
    'offset', v_offset,
    'limit', v_limit,
    'total', COALESCE(v_total, 0),
    'has_more', COALESCE(v_total, 0) > (v_offset + v_limit),
    'venue', jsonb_build_object(
      'name', v_venue.name,
      'slug', v_venue.slug,
      'content_classification', v_venue.content_classification,
      'timezone', v_venue.timezone
    ),
    'items', COALESCE(v_items, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_event(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_event_draft(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_event_for_approval(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_event(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reject_event(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.publish_event_now(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.schedule_event_publication(uuid, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_event(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.archive_event(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.restore_event_to_draft(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.copy_event_to_venue(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_events_module_settings(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_public_venue_events(text, text, text, text, integer, integer) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_event(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_event_draft(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_event_for_approval(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_event(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_event(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_event_now(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_event_publication(uuid, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_event(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_event(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_event_to_draft(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.copy_event_to_venue(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_events_module_settings(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_public_venue_events(text, text, text, text, integer, integer) TO anon, authenticated;
