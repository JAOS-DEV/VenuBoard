-- Venue feed posts. Forward-only. No enum types. RLS is
-- authoritative. Public reads go through RPCs, not base-table anon grants.
-- Feed is venue-authored plain text, not a social network.

CREATE FUNCTION app_private.feed_settings_shape_ok(p_settings jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT
    jsonb_typeof(p_settings) = 'object'
    AND COALESCE((p_settings->>'require_manager_approval')::boolean, false)
      IN (true, false)
    AND COALESCE((p_settings->>'homepage_preview_enabled')::boolean, true)
      IN (true, false)
    AND COALESCE((p_settings->>'homepage_preview_count')::integer, 3)
      BETWEEN 1 AND 6
    AND COALESCE((p_settings->>'horizon_days')::integer, 365)
      BETWEEN 1 AND 730
    AND COALESCE(p_settings->>'display_density', 'comfortable')
      IN ('compact', 'comfortable')
    AND NOT (p_settings ? 'css')
    AND NOT (p_settings ? 'javascript')
    AND NOT (p_settings ? 'html')
    AND NOT (p_settings ? 'script');
$$;

CREATE FUNCTION app_private.protect_feed_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.module_key = 'feed'
     AND NOT app_private.feed_settings_shape_ok(NEW.settings) THEN
    RAISE EXCEPTION 'invalid feed settings'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER venue_module_settings_feed_shape
  BEFORE INSERT OR UPDATE ON public.venue_module_settings
  FOR EACH ROW
  EXECUTE FUNCTION app_private.protect_feed_settings();

CREATE FUNCTION app_private.feed_module_entitled(p_venue_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app_private.module_is_entitled(p_venue_id, 'feed');
$$;

CREATE FUNCTION app_private.feed_module_public(p_venue_id uuid)
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
      AND s.module_key = 'feed'
      AND s.is_enabled
      AND s.is_publicly_visible
      AND app_private.module_is_entitled(p_venue_id, 'feed')
      AND app_private.venue_is_publicly_visible(p_venue_id)
  );
$$;

CREATE FUNCTION app_private.feed_require_manager_approval(p_venue_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (
      SELECT (s.settings->>'require_manager_approval')::boolean
      FROM public.venue_module_settings s
      WHERE s.venue_id = p_venue_id
        AND s.module_key = 'feed'
    ),
    false
  );
$$;

CREATE FUNCTION app_private.feed_media_path_ok(p_venue_id uuid, p_path text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT
    p_path IS NULL
    OR (
      p_path ~ '^[A-Za-z0-9/._-]+$'
      AND p_path NOT LIKE '%..%'
      AND p_path NOT LIKE '%\\%'
      AND p_path NOT ILIKE '%://%'
      AND p_path NOT ILIKE 'javascript:%'
      AND p_path NOT ILIKE 'data:%'
      AND p_path LIKE ('venues/' || p_venue_id::text || '/feed/%')
    );
$$;

CREATE TABLE public.feed_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES public.venues (id) ON DELETE RESTRICT,
  business_id uuid NOT NULL,
  post_type text NOT NULL DEFAULT 'update',
  state text NOT NULL DEFAULT 'draft',
  scheduled_for timestamptz,
  published_at timestamptz,
  submitted_by uuid REFERENCES public.users (id) ON DELETE RESTRICT,
  approved_by uuid REFERENCES public.users (id) ON DELETE RESTRICT,
  approved_at timestamptz,
  rejection_reason text,
  is_pinned boolean NOT NULL DEFAULT false,
  pinned_at timestamptz,
  archived_at timestamptz,
  media_storage_path text,
  source_post_id uuid,
  source_venue_id uuid,
  platform_quarantined_at timestamptz,
  platform_quarantine_reason text,
  platform_quarantined_by uuid REFERENCES public.users (id) ON DELETE RESTRICT,
  created_by uuid REFERENCES public.users (id) ON DELETE RESTRICT,
  updated_by uuid REFERENCES public.users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT feed_posts_venue_business_fkey
    FOREIGN KEY (venue_id, business_id)
    REFERENCES public.venues (id, business_id),
  CONSTRAINT feed_posts_id_venue_id_key UNIQUE (id, venue_id),
  CONSTRAINT feed_posts_type_check CHECK (
    post_type IN ('update', 'announcement', 'notice')
  ),
  CONSTRAINT feed_posts_state_check CHECK (
    state IN (
      'draft',
      'pending_approval',
      'scheduled',
      'published',
      'archived'
    )
  ),
  CONSTRAINT feed_posts_rejection_reason_check CHECK (
    rejection_reason IS NULL OR char_length(rejection_reason) BETWEEN 1 AND 500
  ),
  CONSTRAINT feed_posts_media_path_check CHECK (
    app_private.feed_media_path_ok(venue_id, media_storage_path)
  ),
  CONSTRAINT feed_posts_quarantine_not_public_check CHECK (
    platform_quarantined_at IS NULL
    OR state IN ('draft', 'pending_approval', 'archived')
  ),
  CONSTRAINT feed_posts_archived_consistency_check CHECK (
    (state = 'archived') = (archived_at IS NOT NULL)
  ),
  CONSTRAINT feed_posts_pin_consistency_check CHECK (
    (NOT is_pinned AND pinned_at IS NULL)
    OR (is_pinned AND pinned_at IS NOT NULL)
  ),
  CONSTRAINT feed_posts_source_same_or_null_check CHECK (
    (source_post_id IS NULL) = (source_venue_id IS NULL)
  )
);

COMMENT ON TABLE public.feed_posts IS
  'Venue-authored feed posts. Scheduled visibility is evaluated at query time. Media upload is deferred; media_storage_path is a venue-scoped placeholder only.';

CREATE INDEX feed_posts_venue_state_idx
  ON public.feed_posts (venue_id, state, published_at DESC);
CREATE INDEX feed_posts_venue_public_idx
  ON public.feed_posts (venue_id, is_pinned DESC, published_at DESC, id DESC);
CREATE INDEX feed_posts_venue_scheduled_idx
  ON public.feed_posts (venue_id, scheduled_for);

CREATE TRIGGER feed_posts_set_updated_at
  BEFORE UPDATE ON public.feed_posts
  FOR EACH ROW
  EXECUTE FUNCTION app_private.set_updated_at();

ALTER TABLE public.feed_posts
  ADD CONSTRAINT feed_posts_source_post_fkey
  FOREIGN KEY (source_post_id, source_venue_id)
  REFERENCES public.feed_posts (id, venue_id);

CREATE TABLE public.feed_post_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  venue_id uuid NOT NULL,
  locale text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  updated_by uuid REFERENCES public.users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT feed_post_translations_parent_fkey
    FOREIGN KEY (post_id, venue_id)
    REFERENCES public.feed_posts (id, venue_id)
    ON DELETE RESTRICT,
  CONSTRAINT feed_post_translations_parent_locale_key UNIQUE (post_id, locale),
  CONSTRAINT feed_post_translations_locale_check CHECK (locale IN ('en', 'th')),
  CONSTRAINT feed_post_translations_title_check CHECK (
    char_length(btrim(title)) BETWEEN 1 AND 120
  ),
  CONSTRAINT feed_post_translations_body_check CHECK (
    char_length(btrim(body)) BETWEEN 1 AND 2000
  )
);

COMMENT ON TABLE public.feed_post_translations IS
  'Entity-specific feed translations (data-model post_translations). Public reads require the parent post to be publicly visible.';

CREATE TRIGGER feed_post_translations_set_updated_at
  BEFORE UPDATE ON public.feed_post_translations
  FOR EACH ROW
  EXECUTE FUNCTION app_private.set_updated_at();

CREATE TABLE public.feed_post_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  venue_id uuid NOT NULL,
  action text NOT NULL,
  from_state text,
  to_state text,
  actor_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT feed_post_events_parent_fkey
    FOREIGN KEY (post_id, venue_id)
    REFERENCES public.feed_posts (id, venue_id)
    ON DELETE RESTRICT
);

COMMENT ON TABLE public.feed_post_events IS
  'Append-only feed workflow history. No translation or rejection text.';

CREATE INDEX feed_post_events_post_idx
  ON public.feed_post_events (post_id, created_at DESC);

CREATE FUNCTION app_private.reject_feed_history_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'feed history is append-only'
    USING ERRCODE = '25006';
END;
$$;

CREATE TRIGGER feed_post_events_no_update
  BEFORE UPDATE OR DELETE ON public.feed_post_events
  FOR EACH ROW
  EXECUTE FUNCTION app_private.reject_feed_history_mutation();

CREATE FUNCTION app_private.protect_feed_quarantine()
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

CREATE TRIGGER feed_posts_protect_quarantine
  BEFORE UPDATE ON public.feed_posts
  FOR EACH ROW
  EXECUTE FUNCTION app_private.protect_feed_quarantine();

CREATE FUNCTION app_private.feed_post_is_publicly_visible(
  p_state text,
  p_scheduled_for timestamptz,
  p_published_at timestamptz,
  p_archived_at timestamptz,
  p_quarantined_at timestamptz
)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT
    p_quarantined_at IS NULL
    AND p_archived_at IS NULL
    AND (
      p_state = 'published'
      OR (
        p_state = 'scheduled'
        AND p_scheduled_for IS NOT NULL
        AND p_scheduled_for <= pg_catalog.now()
      )
    )
    AND COALESCE(p_published_at, p_scheduled_for, pg_catalog.now())
      <= pg_catalog.now();
$$;

CREATE FUNCTION app_private.feed_row_is_publicly_visible(p_post_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.feed_posts p
    WHERE p.id = p_post_id
      AND app_private.feed_module_public(p.venue_id)
      AND app_private.feed_post_is_publicly_visible(
        p.state,
        p.scheduled_for,
        p.published_at,
        p.archived_at,
        p.platform_quarantined_at
      )
      AND EXISTS (
        SELECT 1
        FROM public.feed_post_translations t
        WHERE t.post_id = p.id
          AND t.locale = 'en'
      )
  );
$$;

CREATE FUNCTION app_private.protect_feed_pin_visibility()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.is_pinned
     AND NOT app_private.feed_post_is_publicly_visible(
       NEW.state,
       NEW.scheduled_for,
       NEW.published_at,
       NEW.archived_at,
       NEW.platform_quarantined_at
     ) THEN
    NEW.is_pinned := false;
    NEW.pinned_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER feed_posts_protect_pin
  BEFORE INSERT OR UPDATE ON public.feed_posts
  FOR EACH ROW
  EXECUTE FUNCTION app_private.protect_feed_pin_visibility();

CREATE FUNCTION app_private.may_create_feed_post(p_venue_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT app_private.is_user_active() THEN
    RETURN false;
  END IF;
  IF NOT app_private.subscription_allows_tenant_writes(p_venue_id) THEN
    RETURN false;
  END IF;
  IF NOT app_private.feed_module_entitled(p_venue_id) THEN
    RETURN false;
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.venue_module_settings s
    WHERE s.venue_id = p_venue_id
      AND s.module_key = 'feed'
      AND NOT s.is_enabled
  ) THEN
    RETURN false;
  END IF;
  IF app_private.has_tenant_action_on_venue('create_content', p_venue_id) THEN
    RETURN true;
  END IF;
  -- C4: staff may create drafts even though the grant helper stays false.
  IF EXISTS (
    SELECT 1
    FROM public.venue_memberships m
    WHERE m.venue_id = p_venue_id
      AND m.user_id = app_private.current_user_id()
      AND m.status = 'active'
      AND m.role = 'staff'
  ) THEN
    RETURN true;
  END IF;
  RETURN app_private.platform_may_write_tenant(
    (SELECT v.business_id FROM public.venues v WHERE v.id = p_venue_id),
    p_venue_id
  );
END;
$$;

CREATE FUNCTION app_private.may_submit_feed_post(p_venue_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app_private.is_user_active()
    AND app_private.subscription_allows_tenant_writes(p_venue_id)
    AND app_private.feed_module_entitled(p_venue_id)
    AND (
      app_private.has_tenant_action_on_venue(
        'submit_content_for_approval',
        p_venue_id
      )
      OR app_private.may_create_feed_post(p_venue_id)
    );
$$;

CREATE FUNCTION app_private.may_approve_feed_post(p_venue_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app_private.is_user_active()
    AND app_private.subscription_allows_tenant_writes(p_venue_id)
    AND app_private.feed_module_entitled(p_venue_id)
    AND (
      app_private.has_tenant_action_on_venue('approve_content', p_venue_id)
      OR app_private.platform_may_write_tenant(
        (SELECT v.business_id FROM public.venues v WHERE v.id = p_venue_id),
        p_venue_id
      )
    );
$$;

CREATE FUNCTION app_private.may_publish_feed_post(p_venue_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT app_private.is_user_active() THEN
    RETURN false;
  END IF;
  IF NOT app_private.subscription_allows_tenant_writes(p_venue_id) THEN
    RETURN false;
  END IF;
  IF NOT app_private.feed_module_entitled(p_venue_id) THEN
    RETURN false;
  END IF;
  IF app_private.has_tenant_action_on_venue('publish_content', p_venue_id) THEN
    RETURN true;
  END IF;
  -- C5: editor may publish/schedule only when the venue does not require approval.
  IF EXISTS (
    SELECT 1
    FROM public.venue_memberships m
    WHERE m.venue_id = p_venue_id
      AND m.user_id = app_private.current_user_id()
      AND m.status = 'active'
      AND m.role = 'content_editor'
  ) AND NOT app_private.feed_require_manager_approval(p_venue_id) THEN
    RETURN true;
  END IF;
  RETURN app_private.platform_may_write_tenant(
    (SELECT v.business_id FROM public.venues v WHERE v.id = p_venue_id),
    p_venue_id
  );
END;
$$;

CREATE FUNCTION app_private.may_read_feed_admin(p_venue_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    app_private.is_user_active()
    AND (
      app_private.has_tenant_action_on_venue('create_content', p_venue_id)
      OR app_private.has_tenant_action_on_venue(
        'submit_content_for_approval',
        p_venue_id
      )
      OR app_private.has_tenant_action_on_venue('approve_content', p_venue_id)
      OR app_private.has_tenant_action_on_venue('publish_content', p_venue_id)
      OR EXISTS (
        SELECT 1
        FROM public.venue_memberships m
        WHERE m.venue_id = p_venue_id
          AND m.user_id = app_private.current_user_id()
          AND m.status = 'active'
          AND m.role IN (
            'staff',
            'content_editor',
            'venue_manager',
            'business_owner'
          )
      )
      OR EXISTS (
        SELECT 1
        FROM public.venues v
        JOIN public.business_memberships b
          ON b.business_id = v.business_id
         AND b.user_id = app_private.current_user_id()
         AND b.status = 'active'
         AND b.role = 'business_owner'
        WHERE v.id = p_venue_id
      )
      OR app_private.platform_may_read_tenant(
        (SELECT v.business_id FROM public.venues v WHERE v.id = p_venue_id),
        p_venue_id
      )
    );
$$;

CREATE FUNCTION app_private.write_feed_audit(
  p_action text,
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
    p_action,
    'venue',
    p_business_id,
    p_venue_id,
    'feed_posts',
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

CREATE FUNCTION app_private.append_feed_event(
  p_post_id uuid,
  p_venue_id uuid,
  p_action text,
  p_from_state text,
  p_to_state text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.feed_post_events (
    post_id, venue_id, action, from_state, to_state, actor_user_id
  )
  VALUES (
    p_post_id,
    p_venue_id,
    p_action,
    p_from_state,
    p_to_state,
    app_private.current_user_id()
  );
END;
$$;

REVOKE ALL ON public.feed_posts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.feed_post_translations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.feed_post_events FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.feed_posts TO authenticated;
GRANT SELECT ON public.feed_post_translations TO authenticated;
GRANT SELECT ON public.feed_post_events TO authenticated;

ALTER TABLE public.feed_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_posts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.feed_post_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_post_translations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.feed_post_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_post_events FORCE ROW LEVEL SECURITY;

CREATE POLICY feed_posts_select_member ON public.feed_posts
  FOR SELECT TO authenticated
  USING (app_private.may_read_feed_admin(venue_id));

CREATE POLICY feed_post_translations_select_member
  ON public.feed_post_translations
  FOR SELECT TO authenticated
  USING (app_private.may_read_feed_admin(venue_id));

CREATE POLICY feed_post_events_select_member ON public.feed_post_events
  FOR SELECT TO authenticated
  USING (
    app_private.has_tenant_action_on_venue('view_audit_log', venue_id)
    OR app_private.may_read_feed_admin(venue_id)
  );

REVOKE ALL ON FUNCTION app_private.feed_settings_shape_ok(jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.protect_feed_settings()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.feed_module_entitled(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.feed_module_public(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.feed_require_manager_approval(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.feed_media_path_ok(uuid, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.reject_feed_history_mutation()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.protect_feed_quarantine()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.feed_post_is_publicly_visible(
  text, timestamptz, timestamptz, timestamptz, timestamptz
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.feed_row_is_publicly_visible(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.protect_feed_pin_visibility()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.may_create_feed_post(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.may_submit_feed_post(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.may_approve_feed_post(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.may_publish_feed_post(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.may_read_feed_admin(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.write_feed_audit(
  text, uuid, uuid, uuid, text, jsonb, jsonb
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.append_feed_event(
  uuid, uuid, text, text, text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION app_private.may_read_feed_admin(uuid) TO authenticated;
