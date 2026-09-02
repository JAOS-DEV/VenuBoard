-- Staff presence RPCs. Forward-only. Codes only; no SQLERRM in responses.
-- Anonymous execute is limited to list_public_staff_presence.

CREATE FUNCTION app_private.upsert_staff_profile_translation(
  p_profile_id uuid,
  p_venue_id uuid,
  p_locale text,
  p_bio text,
  p_actor uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_bio text;
BEGIN
  IF p_locale IS NULL OR p_locale NOT IN ('en', 'th') THEN
    RETURN;
  END IF;

  v_bio := NULLIF(pg_catalog.btrim(p_bio), '');
  IF v_bio IS NOT NULL AND pg_catalog.char_length(v_bio) > 400 THEN
    RETURN;
  END IF;

  IF v_bio IS NULL THEN
    DELETE FROM public.staff_public_profile_translations t
    WHERE t.staff_public_profile_id = p_profile_id
      AND t.locale = p_locale;
    RETURN;
  END IF;

  INSERT INTO public.staff_public_profile_translations (
    staff_public_profile_id, venue_id, locale, public_bio, updated_by
  )
  VALUES (p_profile_id, p_venue_id, p_locale, v_bio, p_actor)
  ON CONFLICT (staff_public_profile_id, locale)
  DO UPDATE SET
    public_bio = EXCLUDED.public_bio,
    updated_by = EXCLUDED.updated_by,
    updated_at = pg_catalog.now();
END;
$$;

CREATE FUNCTION app_private.write_current_presence(
  p_profile_id uuid,
  p_venue_id uuid,
  p_state text,
  p_source text,
  p_actor uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_expires timestamptz;
  v_existing public.current_staff_presence%ROWTYPE;
  v_unchanged boolean := false;
  v_current_source text;
BEGIN
  v_current_source := CASE WHEN p_source = 'self' THEN 'self' ELSE 'manager' END;

  IF p_state = 'present' THEN
    v_expires := pg_catalog.now()
      + ((app_private.staff_presence_expiry_hours(p_venue_id))::text || ' hours')::interval;
  ELSE
    v_expires := NULL;
  END IF;

  SELECT * INTO v_existing
  FROM public.current_staff_presence c
  WHERE c.staff_public_profile_id = p_profile_id
  FOR UPDATE;

  IF FOUND THEN
    v_unchanged :=
      v_existing.state = p_state
      AND (
        p_state = 'not_present'
        OR (
          p_state = 'present'
          AND v_existing.presence_expires_at IS NOT NULL
          AND v_existing.presence_expires_at > pg_catalog.now()
        )
      );

    UPDATE public.current_staff_presence
    SET
      state = p_state,
      presence_expires_at = v_expires,
      changed_at = pg_catalog.now(),
      changed_by = p_actor,
      source = v_current_source
    WHERE staff_public_profile_id = p_profile_id;
  ELSE
    INSERT INTO public.current_staff_presence (
      venue_id, staff_public_profile_id, state, changed_at, changed_by,
      presence_expires_at, source
    )
    VALUES (
      p_venue_id, p_profile_id, p_state, pg_catalog.now(), p_actor, v_expires, v_current_source
    );
  END IF;

  IF NOT v_unchanged THEN
    INSERT INTO public.staff_presence_events (
      venue_id, staff_public_profile_id, state, changed_at, changed_by,
      presence_expires_at, source
    )
    VALUES (
      p_venue_id, p_profile_id, p_state, pg_catalog.now(), p_actor, v_expires, p_source
    );
  END IF;
END;
$$;

CREATE FUNCTION public.create_staff_member_with_profile(
  p_venue_id uuid,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid;
  v_business uuid;
  v_internal text;
  v_user uuid;
  v_public_name text;
  v_title text;
  v_avatar text;
  v_order integer;
  v_publication text;
  v_consent text;
  v_staff_id uuid;
  v_profile_id uuid;
BEGIN
  v_actor := app_private.current_user_id();
  IF v_actor IS NULL OR app_private.jwt_role() IS DISTINCT FROM 'authenticated' THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'unauthenticated');
  END IF;

  IF p_venue_id IS NULL OR p_payload IS NULL OR pg_catalog.jsonb_typeof(p_payload) <> 'object' THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_payload');
  END IF;

  IF NOT app_private.may_manage_public_staff_profiles(p_venue_id) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'forbidden');
  END IF;

  v_business := app_private.venue_business_id(p_venue_id);
  v_internal := pg_catalog.btrim(p_payload->>'internal_display_name');
  v_public_name := pg_catalog.btrim(COALESCE(p_payload->>'public_display_name', v_internal));
  v_title := NULLIF(pg_catalog.btrim(p_payload->>'public_title'), '');
  v_avatar := NULLIF(pg_catalog.btrim(p_payload->>'avatar_storage_path'), '');
  v_order := COALESCE(NULLIF(p_payload->>'display_order', '')::integer, 0);
  v_publication := COALESCE(NULLIF(p_payload->>'publication_state', ''), 'draft');
  v_consent := COALESCE(NULLIF(p_payload->>'consent_state', ''), 'pending');

  IF p_payload ? 'user_id' AND NULLIF(p_payload->>'user_id', '') IS NOT NULL THEN
    BEGIN
      v_user := (p_payload->>'user_id')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_payload');
    END;
  END IF;

  IF v_internal IS NULL OR pg_catalog.char_length(v_internal) NOT BETWEEN 1 AND 120 THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_payload');
  END IF;

  IF v_public_name IS NULL OR pg_catalog.char_length(v_public_name) NOT BETWEEN 1 AND 120 THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_payload');
  END IF;

  IF v_publication NOT IN ('draft', 'published')
     OR v_consent NOT IN ('pending', 'granted', 'withdrawn') THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_payload');
  END IF;

  IF v_publication = 'published' AND v_consent <> 'granted' THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_payload');
  END IF;

  INSERT INTO public.staff_members (
    business_id, user_id, internal_display_name, status, created_by, updated_by
  )
  VALUES (v_business, v_user, v_internal, 'active', v_actor, v_actor)
  RETURNING id INTO v_staff_id;

  INSERT INTO public.staff_public_profiles (
    venue_id, business_id, staff_member_id, public_display_name, public_title,
    avatar_storage_path, display_order, assignment_status, publication_state,
    consent_state, consent_recorded_at, consent_recorded_by, created_by, updated_by
  )
  VALUES (
    p_venue_id,
    v_business,
    v_staff_id,
    v_public_name,
    v_title,
    v_avatar,
    GREATEST(v_order, 0),
    'active',
    v_publication,
    v_consent,
    CASE WHEN v_consent = 'pending' THEN NULL ELSE pg_catalog.now() END,
    CASE WHEN v_consent = 'pending' THEN NULL ELSE v_actor END,
    v_actor,
    v_actor
  )
  RETURNING id INTO v_profile_id;

  PERFORM app_private.upsert_staff_profile_translation(
    v_profile_id, p_venue_id, 'en', p_payload->>'bio_en', v_actor
  );
  PERFORM app_private.upsert_staff_profile_translation(
    v_profile_id, p_venue_id, 'th', p_payload->>'bio_th', v_actor
  );
  PERFORM app_private.write_current_presence(
    v_profile_id, p_venue_id, 'not_present', 'manager', v_actor
  );

  IF v_consent <> 'pending' THEN
    INSERT INTO public.staff_consent_events (
      venue_id, staff_public_profile_id, consent_state, recorded_by, source
    )
    VALUES (p_venue_id, v_profile_id, v_consent, v_actor, 'manager');
  END IF;

  PERFORM app_private.write_staff_audit(
    'manage_public_staff_profiles',
    v_business,
    p_venue_id,
    'staff_members',
    v_staff_id,
    'created staff member and venue profile',
    NULL,
    pg_catalog.jsonb_build_object(
      'staff_member_id', v_staff_id,
      'profile_id', v_profile_id,
      'publication_state', v_publication,
      'consent_state', v_consent
    )
  );

  RETURN pg_catalog.jsonb_build_object(
    'ok', true,
    'staff_member_id', v_staff_id,
    'profile_id', v_profile_id
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'conflict');
  WHEN check_violation THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_payload');
  WHEN OTHERS THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'unavailable');
END;
$$;

CREATE FUNCTION public.assign_staff_to_venue(
  p_staff_member_id uuid,
  p_venue_id uuid,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid;
  v_business uuid;
  v_staff public.staff_members%ROWTYPE;
  v_public_name text;
  v_profile_id uuid;
  v_publication text;
  v_consent text;
BEGIN
  v_actor := app_private.current_user_id();
  IF v_actor IS NULL OR app_private.jwt_role() IS DISTINCT FROM 'authenticated' THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'unauthenticated');
  END IF;

  IF p_staff_member_id IS NULL OR p_venue_id IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_payload');
  END IF;

  IF p_payload IS NULL THEN
    p_payload := '{}'::jsonb;
  END IF;

  IF NOT app_private.may_manage_public_staff_profiles(p_venue_id) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'forbidden');
  END IF;

  SELECT * INTO v_staff
  FROM public.staff_members m
  WHERE m.id = p_staff_member_id;

  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'not_found');
  END IF;

  v_business := app_private.venue_business_id(p_venue_id);
  IF v_staff.business_id IS DISTINCT FROM v_business THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'forbidden');
  END IF;

  IF v_staff.status <> 'active' THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'inactive');
  END IF;

  v_public_name := pg_catalog.btrim(COALESCE(
    p_payload->>'public_display_name',
    v_staff.internal_display_name
  ));
  v_publication := COALESCE(NULLIF(p_payload->>'publication_state', ''), 'draft');
  v_consent := COALESCE(NULLIF(p_payload->>'consent_state', ''), 'pending');

  IF v_publication = 'published' AND v_consent <> 'granted' THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_payload');
  END IF;

  INSERT INTO public.staff_public_profiles (
    venue_id, business_id, staff_member_id, public_display_name, public_title,
    avatar_storage_path, display_order, assignment_status, publication_state,
    consent_state, consent_recorded_at, consent_recorded_by, created_by, updated_by
  )
  VALUES (
    p_venue_id,
    v_business,
    p_staff_member_id,
    v_public_name,
    NULLIF(pg_catalog.btrim(p_payload->>'public_title'), ''),
    NULLIF(pg_catalog.btrim(p_payload->>'avatar_storage_path'), ''),
    GREATEST(COALESCE(NULLIF(p_payload->>'display_order', '')::integer, 0), 0),
    'active',
    v_publication,
    v_consent,
    CASE WHEN v_consent = 'pending' THEN NULL ELSE pg_catalog.now() END,
    CASE WHEN v_consent = 'pending' THEN NULL ELSE v_actor END,
    v_actor,
    v_actor
  )
  RETURNING id INTO v_profile_id;

  PERFORM app_private.upsert_staff_profile_translation(
    v_profile_id, p_venue_id, 'en', p_payload->>'bio_en', v_actor
  );
  PERFORM app_private.upsert_staff_profile_translation(
    v_profile_id, p_venue_id, 'th', p_payload->>'bio_th', v_actor
  );
  PERFORM app_private.write_current_presence(
    v_profile_id, p_venue_id, 'not_present', 'manager', v_actor
  );

  PERFORM app_private.write_staff_audit(
    'manage_public_staff_profiles',
    v_business,
    p_venue_id,
    'staff_public_profiles',
    v_profile_id,
    'assigned staff to venue',
    NULL,
    pg_catalog.jsonb_build_object(
      'staff_member_id', p_staff_member_id,
      'profile_id', v_profile_id
    )
  );

  RETURN pg_catalog.jsonb_build_object(
    'ok', true,
    'staff_member_id', p_staff_member_id,
    'profile_id', v_profile_id
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'conflict');
  WHEN check_violation THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_payload');
  WHEN OTHERS THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'unavailable');
END;
$$;

CREATE FUNCTION public.update_staff_public_profile(
  p_profile_id uuid,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid;
  v_profile public.staff_public_profiles%ROWTYPE;
  v_manager boolean;
  v_own boolean;
  v_name text;
  v_title text;
  v_avatar text;
  v_order integer;
  v_publication text;
  v_assignment text;
BEGIN
  v_actor := app_private.current_user_id();
  IF v_actor IS NULL OR app_private.jwt_role() IS DISTINCT FROM 'authenticated' THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'unauthenticated');
  END IF;

  IF p_profile_id IS NULL OR p_payload IS NULL OR pg_catalog.jsonb_typeof(p_payload) <> 'object' THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_payload');
  END IF;

  SELECT * INTO v_profile
  FROM public.staff_public_profiles p
  WHERE p.id = p_profile_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'not_found');
  END IF;

  v_manager := app_private.may_manage_public_staff_profiles(v_profile.venue_id);
  v_own := app_private.may_manage_own_public_profile(p_profile_id);

  IF NOT v_manager AND NOT v_own THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'forbidden');
  END IF;

  v_name := pg_catalog.btrim(COALESCE(p_payload->>'public_display_name', v_profile.public_display_name));
  v_title := CASE
    WHEN p_payload ? 'public_title' THEN NULLIF(pg_catalog.btrim(p_payload->>'public_title'), '')
    ELSE v_profile.public_title
  END;
  v_avatar := CASE
    WHEN p_payload ? 'avatar_storage_path'
      THEN NULLIF(pg_catalog.btrim(p_payload->>'avatar_storage_path'), '')
    ELSE v_profile.avatar_storage_path
  END;
  v_order := v_profile.display_order;
  v_publication := v_profile.publication_state;
  v_assignment := v_profile.assignment_status;

  IF v_manager THEN
    IF p_payload ? 'display_order' THEN
      v_order := GREATEST(COALESCE(NULLIF(p_payload->>'display_order', '')::integer, 0), 0);
    END IF;
    IF p_payload ? 'publication_state' THEN
      v_publication := p_payload->>'publication_state';
    END IF;
    IF p_payload ? 'assignment_status' THEN
      v_assignment := p_payload->>'assignment_status';
    END IF;
  END IF;

  IF v_publication = 'published' AND v_profile.consent_state <> 'granted' THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_payload');
  END IF;

  UPDATE public.staff_public_profiles
  SET
    public_display_name = v_name,
    public_title = v_title,
    avatar_storage_path = v_avatar,
    display_order = v_order,
    publication_state = v_publication,
    assignment_status = v_assignment,
    updated_by = v_actor
  WHERE id = p_profile_id;

  IF p_payload ? 'bio_en' THEN
    PERFORM app_private.upsert_staff_profile_translation(
      p_profile_id, v_profile.venue_id, 'en', p_payload->>'bio_en', v_actor
    );
  END IF;
  IF p_payload ? 'bio_th' THEN
    PERFORM app_private.upsert_staff_profile_translation(
      p_profile_id, v_profile.venue_id, 'th', p_payload->>'bio_th', v_actor
    );
  END IF;

  PERFORM app_private.write_staff_audit(
    CASE WHEN v_manager THEN 'manage_public_staff_profiles' ELSE 'manage_own_public_profile' END,
    v_profile.business_id,
    v_profile.venue_id,
    'staff_public_profiles',
    p_profile_id,
    'updated public staff profile',
    pg_catalog.jsonb_build_object(
      'publication_state', v_profile.publication_state,
      'assignment_status', v_profile.assignment_status
    ),
    pg_catalog.jsonb_build_object(
      'publication_state', v_publication,
      'assignment_status', v_assignment
    )
  );

  RETURN pg_catalog.jsonb_build_object('ok', true, 'profile_id', p_profile_id);
EXCEPTION
  WHEN check_violation THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_payload');
  WHEN OTHERS THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'unavailable');
END;
$$;

CREATE FUNCTION public.set_staff_public_consent(
  p_profile_id uuid,
  p_consent_state text
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid;
  v_profile public.staff_public_profiles%ROWTYPE;
  v_source text;
  v_publication text;
BEGIN
  v_actor := app_private.current_user_id();
  IF v_actor IS NULL OR app_private.jwt_role() IS DISTINCT FROM 'authenticated' THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'unauthenticated');
  END IF;

  IF p_profile_id IS NULL OR p_consent_state NOT IN ('pending', 'granted', 'withdrawn') THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_payload');
  END IF;

  SELECT * INTO v_profile
  FROM public.staff_public_profiles p
  WHERE p.id = p_profile_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'not_found');
  END IF;

  IF app_private.may_manage_own_consent(p_profile_id) THEN
    v_source := 'self';
  ELSIF app_private.may_manage_public_staff_profiles(v_profile.venue_id) THEN
    v_source := 'manager';
  ELSE
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'forbidden');
  END IF;

  v_publication := v_profile.publication_state;
  IF p_consent_state <> 'granted' AND v_publication = 'published' THEN
    v_publication := 'draft';
  END IF;

  UPDATE public.staff_public_profiles
  SET
    consent_state = p_consent_state,
    consent_recorded_at = CASE
      WHEN p_consent_state = 'pending' THEN NULL
      ELSE pg_catalog.now()
    END,
    consent_recorded_by = CASE
      WHEN p_consent_state = 'pending' THEN NULL
      ELSE v_actor
    END,
    publication_state = v_publication,
    updated_by = v_actor
  WHERE id = p_profile_id;

  INSERT INTO public.staff_consent_events (
    venue_id, staff_public_profile_id, consent_state, recorded_by, source
  )
  VALUES (v_profile.venue_id, p_profile_id, p_consent_state, v_actor, v_source);

  PERFORM app_private.write_staff_audit(
    CASE WHEN v_source = 'self' THEN 'manage_own_consent' ELSE 'manage_public_staff_profiles' END,
    v_profile.business_id,
    v_profile.venue_id,
    'staff_public_profiles',
    p_profile_id,
    'updated staff public-display consent',
    pg_catalog.jsonb_build_object('consent_state', v_profile.consent_state),
    pg_catalog.jsonb_build_object('consent_state', p_consent_state)
  );

  RETURN pg_catalog.jsonb_build_object('ok', true, 'profile_id', p_profile_id, 'consent_state', p_consent_state);
EXCEPTION
  WHEN check_violation THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_payload');
  WHEN OTHERS THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'unavailable');
END;
$$;

CREATE FUNCTION public.set_staff_presence(
  p_profile_id uuid,
  p_state text
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid;
  v_profile public.staff_public_profiles%ROWTYPE;
  v_source text;
  v_role text;
BEGIN
  v_actor := app_private.current_user_id();
  IF v_actor IS NULL OR app_private.jwt_role() IS DISTINCT FROM 'authenticated' THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'unauthenticated');
  END IF;

  IF p_profile_id IS NULL OR p_state NOT IN ('present', 'not_present') THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_payload');
  END IF;

  SELECT * INTO v_profile
  FROM public.staff_public_profiles p
  WHERE p.id = p_profile_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'not_found');
  END IF;

  IF NOT app_private.may_set_staff_presence(v_profile.venue_id, p_profile_id) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'forbidden');
  END IF;

  v_role := app_private.venue_membership_role(v_profile.venue_id);
  IF app_private.has_tenant_action_on_venue('toggle_staff_presence', v_profile.venue_id)
     AND v_role IS DISTINCT FROM 'staff' THEN
    v_source := 'manager';
  ELSE
    v_source := 'self';
  END IF;

  PERFORM app_private.write_current_presence(
    p_profile_id, v_profile.venue_id, p_state, v_source, v_actor
  );

  PERFORM app_private.write_staff_audit(
    CASE WHEN v_source = 'self' THEN 'toggle_own_presence' ELSE 'toggle_staff_presence' END,
    v_profile.business_id,
    v_profile.venue_id,
    'current_staff_presence',
    p_profile_id,
    'updated staff presence',
    NULL,
    pg_catalog.jsonb_build_object('state', p_state)
  );

  RETURN pg_catalog.jsonb_build_object('ok', true, 'profile_id', p_profile_id, 'state', p_state);
EXCEPTION
  WHEN check_violation THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_payload');
  WHEN OTHERS THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'unavailable');
END;
$$;

CREATE FUNCTION public.bulk_mark_staff_not_present(p_venue_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid;
  v_profile_id uuid;
  v_count integer := 0;
BEGIN
  v_actor := app_private.current_user_id();
  IF v_actor IS NULL OR app_private.jwt_role() IS DISTINCT FROM 'authenticated' THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'unauthenticated');
  END IF;

  IF p_venue_id IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_payload');
  END IF;

  IF NOT app_private.has_tenant_action_on_venue('toggle_staff_presence', p_venue_id)
     OR NOT app_private.staff_presence_module_entitled(p_venue_id)
     OR NOT app_private.subscription_allows_tenant_writes(p_venue_id) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'forbidden');
  END IF;

  FOR v_profile_id IN
    SELECT p.id
    FROM public.staff_public_profiles p
    WHERE p.venue_id = p_venue_id
    FOR UPDATE
  LOOP
    PERFORM app_private.write_current_presence(
      v_profile_id, p_venue_id, 'not_present', 'bulk_reset', v_actor
    );
    v_count := v_count + 1;
  END LOOP;

  PERFORM app_private.write_staff_audit(
    'toggle_staff_presence',
    app_private.venue_business_id(p_venue_id),
    p_venue_id,
    'current_staff_presence',
    p_venue_id,
    'bulk marked venue staff not present',
    NULL,
    pg_catalog.jsonb_build_object('reset_count', v_count)
  );

  RETURN pg_catalog.jsonb_build_object('ok', true, 'reset_count', v_count);
EXCEPTION
  WHEN OTHERS THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'unavailable');
END;
$$;

CREATE FUNCTION public.deactivate_staff_member(p_staff_member_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid;
  v_staff public.staff_members%ROWTYPE;
  v_profile record;
  v_first_venue uuid;
BEGIN
  v_actor := app_private.current_user_id();
  IF v_actor IS NULL OR app_private.jwt_role() IS DISTINCT FROM 'authenticated' THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'unauthenticated');
  END IF;

  SELECT * INTO v_staff
  FROM public.staff_members m
  WHERE m.id = p_staff_member_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'not_found');
  END IF;

  SELECT p.venue_id INTO v_first_venue
  FROM public.staff_public_profiles p
  WHERE p.staff_member_id = p_staff_member_id
  ORDER BY p.created_at
  LIMIT 1;

  IF v_first_venue IS NULL
     OR NOT app_private.may_manage_public_staff_profiles(v_first_venue) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'forbidden');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.staff_public_profiles p
    WHERE p.staff_member_id = p_staff_member_id
      AND NOT app_private.may_manage_public_staff_profiles(p.venue_id)
  ) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'forbidden');
  END IF;

  IF v_staff.status = 'deactivated' THEN
    RETURN pg_catalog.jsonb_build_object('ok', true, 'staff_member_id', p_staff_member_id, 'status', 'deactivated');
  END IF;

  UPDATE public.staff_members
  SET
    status = 'deactivated',
    deactivated_at = pg_catalog.now(),
    deactivated_by = v_actor,
    updated_by = v_actor
  WHERE id = p_staff_member_id;

  FOR v_profile IN
    SELECT p.id, p.venue_id
    FROM public.staff_public_profiles p
    WHERE p.staff_member_id = p_staff_member_id
    FOR UPDATE
  LOOP
    PERFORM app_private.write_current_presence(
      v_profile.id, v_profile.venue_id, 'not_present', 'deactivation', v_actor
    );
  END LOOP;

  PERFORM app_private.write_staff_audit(
    'manage_public_staff_profiles',
    v_staff.business_id,
    v_first_venue,
    'staff_members',
    p_staff_member_id,
    'deactivated staff member',
    pg_catalog.jsonb_build_object('status', 'active'),
    pg_catalog.jsonb_build_object('status', 'deactivated')
  );

  RETURN pg_catalog.jsonb_build_object('ok', true, 'staff_member_id', p_staff_member_id, 'status', 'deactivated');
EXCEPTION
  WHEN OTHERS THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'unavailable');
END;
$$;

CREATE FUNCTION public.restore_staff_member(p_staff_member_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid;
  v_staff public.staff_members%ROWTYPE;
  v_profile record;
  v_first_venue uuid;
  v_next_consent text;
BEGIN
  v_actor := app_private.current_user_id();
  IF v_actor IS NULL OR app_private.jwt_role() IS DISTINCT FROM 'authenticated' THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'unauthenticated');
  END IF;

  SELECT * INTO v_staff
  FROM public.staff_members m
  WHERE m.id = p_staff_member_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'not_found');
  END IF;

  SELECT p.venue_id INTO v_first_venue
  FROM public.staff_public_profiles p
  WHERE p.staff_member_id = p_staff_member_id
  ORDER BY p.created_at
  LIMIT 1;

  IF v_first_venue IS NULL
     OR NOT app_private.may_manage_public_staff_profiles(v_first_venue) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'forbidden');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.staff_public_profiles p
    WHERE p.staff_member_id = p_staff_member_id
      AND NOT app_private.may_manage_public_staff_profiles(p.venue_id)
  ) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'forbidden');
  END IF;

  UPDATE public.staff_members
  SET
    status = 'active',
    deactivated_at = NULL,
    deactivated_by = NULL,
    restored_at = pg_catalog.now(),
    restored_by = v_actor,
    updated_by = v_actor
  WHERE id = p_staff_member_id;

  FOR v_profile IN
    SELECT p.id, p.venue_id, p.consent_state
    FROM public.staff_public_profiles p
    WHERE p.staff_member_id = p_staff_member_id
    FOR UPDATE
  LOOP
    v_next_consent := CASE
      WHEN v_profile.consent_state = 'withdrawn' THEN 'withdrawn'
      ELSE 'pending'
    END;

    UPDATE public.staff_public_profiles
    SET
      publication_state = 'draft',
      consent_state = v_next_consent,
      consent_recorded_at = CASE
        WHEN v_next_consent = 'withdrawn' THEN consent_recorded_at
        ELSE NULL
      END,
      consent_recorded_by = CASE
        WHEN v_next_consent = 'withdrawn' THEN consent_recorded_by
        ELSE NULL
      END,
      updated_by = v_actor
    WHERE id = v_profile.id;

    IF v_next_consent = 'pending' AND v_profile.consent_state <> 'pending' THEN
      INSERT INTO public.staff_consent_events (
        venue_id, staff_public_profile_id, consent_state, recorded_by, source
      )
      VALUES (v_profile.venue_id, v_profile.id, 'pending', v_actor, 'restoration');
    END IF;

    PERFORM app_private.write_current_presence(
      v_profile.id, v_profile.venue_id, 'not_present', 'manager', v_actor
    );
  END LOOP;

  PERFORM app_private.write_staff_audit(
    'manage_public_staff_profiles',
    v_staff.business_id,
    v_first_venue,
    'staff_members',
    p_staff_member_id,
    'restored staff member',
    pg_catalog.jsonb_build_object('status', 'deactivated'),
    pg_catalog.jsonb_build_object('status', 'active')
  );

  RETURN pg_catalog.jsonb_build_object('ok', true, 'staff_member_id', p_staff_member_id, 'status', 'active');
EXCEPTION
  WHEN OTHERS THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'unavailable');
END;
$$;

CREATE FUNCTION public.list_public_staff_presence(
  p_venue_slug text,
  p_locale text DEFAULT 'en',
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
  v_slug text;
  v_locale text;
  v_limit integer;
  v_offset integer;
  v_venue public.venues%ROWTYPE;
  v_settings public.venue_module_settings%ROWTYPE;
  v_heading text;
  v_mode text;
  v_order text;
  v_auto boolean;
  v_items jsonb;
  v_total integer;
BEGIN
  v_slug := pg_catalog.lower(pg_catalog.btrim(COALESCE(p_venue_slug, '')));
  v_locale := CASE WHEN p_locale IN ('en', 'th') THEN p_locale ELSE 'en' END;
  v_limit := LEAST(GREATEST(COALESCE(p_limit, 24), 1), 24);
  v_offset := GREATEST(COALESCE(p_offset, 0), 0);

  IF v_slug = '' THEN
    RETURN pg_catalog.jsonb_build_object('ok', true, 'available', false);
  END IF;

  SELECT * INTO v_venue
  FROM public.venues v
  WHERE v.slug = v_slug;

  IF NOT FOUND OR NOT app_private.venue_is_publicly_visible(v_venue.id) THEN
    RETURN pg_catalog.jsonb_build_object('ok', true, 'available', false);
  END IF;

  IF NOT app_private.staff_presence_module_public(v_venue.id) THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', true,
      'available', false,
      'venue', pg_catalog.jsonb_build_object(
        'name', v_venue.name,
        'slug', v_venue.slug,
        'content_classification', v_venue.content_classification
      )
    );
  END IF;

  SELECT * INTO v_settings
  FROM public.venue_module_settings s
  WHERE s.venue_id = v_venue.id
    AND s.module_key = 'staff_presence';

  v_mode := COALESCE(v_settings.settings->>'display_mode', 'all_published');
  IF v_mode NOT IN ('present_only', 'all_published') THEN
    v_mode := 'all_published';
  END IF;
  v_order := COALESCE(v_settings.settings->>'carousel_order', 'display_order');
  IF v_order NOT IN ('display_order', 'name') THEN
    v_order := 'display_order';
  END IF;
  v_auto := COALESCE((v_settings.settings->>'carousel_auto_advance')::boolean, false);

  SELECT t.public_heading INTO v_heading
  FROM public.venue_module_setting_translations t
  WHERE t.venue_module_setting_id = v_settings.id
    AND t.locale = v_locale
  LIMIT 1;

  IF v_heading IS NULL THEN
    SELECT t.public_heading INTO v_heading
    FROM public.venue_module_setting_translations t
    WHERE t.venue_module_setting_id = v_settings.id
      AND t.locale = v_venue.default_locale
    LIMIT 1;
  END IF;

  IF v_heading IS NULL THEN
    SELECT t.public_heading INTO v_heading
    FROM public.venue_module_setting_translations t
    WHERE t.venue_module_setting_id = v_settings.id
      AND t.locale = 'en'
    LIMIT 1;
  END IF;

  WITH eligible AS (
    SELECT
      p.id,
      p.public_display_name,
      p.public_title,
      p.display_order,
      app_private.effective_presence_state(c.state, c.presence_expires_at) AS presence_state,
      COALESCE(
        (
          SELECT tr.public_bio
          FROM public.staff_public_profile_translations tr
          WHERE tr.staff_public_profile_id = p.id
            AND tr.locale = v_locale
          LIMIT 1
        ),
        (
          SELECT tr.public_bio
          FROM public.staff_public_profile_translations tr
          WHERE tr.staff_public_profile_id = p.id
            AND tr.locale = v_venue.default_locale
          LIMIT 1
        ),
        (
          SELECT tr.public_bio
          FROM public.staff_public_profile_translations tr
          WHERE tr.staff_public_profile_id = p.id
            AND tr.locale = 'en'
          LIMIT 1
        )
      ) AS public_bio
    FROM public.staff_public_profiles p
    JOIN public.staff_members m
      ON m.id = p.staff_member_id
     AND m.business_id = p.business_id
    LEFT JOIN public.current_staff_presence c
      ON c.staff_public_profile_id = p.id
    WHERE p.venue_id = v_venue.id
      AND m.status = 'active'
      AND p.assignment_status = 'active'
      AND p.publication_state = 'published'
      AND p.consent_state = 'granted'
      AND p.platform_quarantined_at IS NULL
  ),
  filtered AS (
    SELECT *
    FROM eligible e
    WHERE v_mode <> 'present_only' OR e.presence_state = 'present'
  )
  SELECT
    COALESCE(
      (
        SELECT pg_catalog.jsonb_agg(row_data ORDER BY sort1, sort2, sort3)
        FROM (
          SELECT
            pg_catalog.jsonb_build_object(
              'public_id', f.id,
              'display_name', f.public_display_name,
              'title', f.public_title,
              'bio', f.public_bio,
              'presence_state', f.presence_state
            ) AS row_data,
            CASE WHEN v_order = 'name' THEN f.public_display_name ELSE NULL END AS sort1,
            f.display_order AS sort2,
            f.public_display_name AS sort3
          FROM filtered f
          ORDER BY
            CASE WHEN v_order = 'name' THEN f.public_display_name END ASC,
            f.display_order ASC,
            f.public_display_name ASC,
            f.id ASC
          OFFSET v_offset
          LIMIT v_limit
        ) page_rows
      ),
      '[]'::jsonb
    ),
    (SELECT count(*)::integer FROM filtered)
  INTO v_items, v_total;

  RETURN pg_catalog.jsonb_build_object(
    'ok', true,
    'available', true,
    'heading', v_heading,
    'display_mode', v_mode,
    'carousel_order', v_order,
    'auto_advance', v_auto,
    'locale', v_locale,
    'offset', v_offset,
    'limit', v_limit,
    'total', v_total,
    'has_more', (v_offset + v_limit) < v_total,
    'venue', pg_catalog.jsonb_build_object(
      'name', v_venue.name,
      'slug', v_venue.slug,
      'content_classification', v_venue.content_classification
    ),
    'items', v_items
  );
END;
$$;

COMMENT ON FUNCTION public.list_public_staff_presence(text, text, integer, integer) IS
  'Bounded public staff carousel query. Hidden profiles are omitted without leaking their existence. Presence expiry is applied in the query; no background job is required.';

COMMENT ON FUNCTION public.create_staff_member_with_profile(uuid, jsonb) IS
  'Creates a private staff record and first venue public profile in one transaction.';

COMMENT ON FUNCTION public.set_staff_presence(uuid, text) IS
  'Idempotent presence toggle. Present rows receive a bounded presence_expires_at. Not attendance.';

REVOKE ALL ON FUNCTION app_private.upsert_staff_profile_translation(uuid, uuid, text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.write_current_presence(uuid, uuid, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.upsert_staff_profile_translation(uuid, uuid, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.write_current_presence(uuid, uuid, text, text, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.create_staff_member_with_profile(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.assign_staff_to_venue(uuid, uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_staff_public_profile(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_staff_public_consent(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_staff_presence(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.bulk_mark_staff_not_present(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.deactivate_staff_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.restore_staff_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_public_staff_presence(text, text, integer, integer) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_staff_member_with_profile(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_staff_to_venue(uuid, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_staff_public_profile(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_staff_public_consent(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_staff_presence(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_mark_staff_not_present(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deactivate_staff_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_staff_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_public_staff_presence(text, text, integer, integer) TO anon, authenticated;
