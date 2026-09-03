-- Events and public calendar. Forward-only. No enum types. RLS is
-- authoritative. Public reads go through RPCs, not base-table anon grants.

CREATE FUNCTION app_private.events_settings_shape_ok(p_settings jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT
    jsonb_typeof(p_settings) = 'object'
    AND COALESCE(p_settings->>'default_display', 'calendar_and_list')
      IN ('upcoming_list', 'calendar_and_list')
    AND COALESCE((p_settings->>'max_upcoming')::integer, 24) BETWEEN 1 AND 48
    AND COALESCE((p_settings->>'horizon_days')::integer, 90) BETWEEN 1 AND 366
    AND COALESCE((p_settings->>'show_past_archive')::boolean, false) IN (true, false)
    AND COALESCE(p_settings->>'event_order', 'starts_at_asc')
      IN ('starts_at_asc', 'starts_at_desc')
    AND COALESCE((p_settings->>'require_manager_approval')::boolean, false)
      IN (true, false)
    AND NOT (p_settings ? 'css')
    AND NOT (p_settings ? 'javascript')
    AND NOT (p_settings ? 'html')
    AND NOT (p_settings ? 'script');
$$;

CREATE FUNCTION app_private.protect_events_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.module_key = 'events'
     AND NOT app_private.events_settings_shape_ok(NEW.settings) THEN
    RAISE EXCEPTION 'invalid events settings'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER venue_module_settings_events_shape
  BEFORE INSERT OR UPDATE ON public.venue_module_settings
  FOR EACH ROW
  EXECUTE FUNCTION app_private.protect_events_settings();

CREATE FUNCTION app_private.is_supported_timezone(p_timezone text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_timezone_names t
    WHERE t.name = p_timezone
  );
$$;

CREATE FUNCTION app_private.events_module_entitled(p_venue_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app_private.module_is_entitled(p_venue_id, 'events');
$$;

CREATE FUNCTION app_private.events_module_public(p_venue_id uuid)
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
      AND s.module_key = 'events'
      AND s.is_enabled
      AND s.is_publicly_visible
      AND app_private.module_is_entitled(p_venue_id, 'events')
      AND app_private.venue_is_publicly_visible(p_venue_id)
  );
$$;

CREATE FUNCTION app_private.events_require_manager_approval(p_venue_id uuid)
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
        AND s.module_key = 'events'
    ),
    false
  );
$$;

CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES public.venues (id) ON DELETE RESTRICT,
  business_id uuid NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  timezone text NOT NULL,
  is_all_day boolean NOT NULL DEFAULT false,
  state text NOT NULL DEFAULT 'draft',
  approval_status text NOT NULL DEFAULT 'not_submitted',
  rejection_reason text,
  publish_at timestamptz,
  published_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  archived_at timestamptz,
  poster_storage_path text,
  source_event_id uuid,
  source_venue_id uuid,
  recurrence_rule text,
  platform_quarantined_at timestamptz,
  platform_quarantine_reason text,
  platform_quarantined_by uuid REFERENCES public.users (id) ON DELETE RESTRICT,
  created_by uuid REFERENCES public.users (id) ON DELETE RESTRICT,
  updated_by uuid REFERENCES public.users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT events_venue_business_fkey
    FOREIGN KEY (venue_id, business_id)
    REFERENCES public.venues (id, business_id),
  CONSTRAINT events_id_venue_id_key UNIQUE (id, venue_id),
  CONSTRAINT events_state_check CHECK (
    state IN ('draft', 'scheduled', 'published', 'cancelled', 'archived')
  ),
  CONSTRAINT events_approval_check CHECK (
    approval_status IN ('not_submitted', 'pending', 'approved', 'rejected')
  ),
  CONSTRAINT events_end_after_start_check CHECK (ends_at > starts_at),
  CONSTRAINT events_duration_bound_check CHECK (
    ends_at <= starts_at + interval '7 days'
  ),
  CONSTRAINT events_timezone_check CHECK (
    char_length(timezone) BETWEEN 1 AND 64
  ),
  CONSTRAINT events_poster_path_check CHECK (
    poster_storage_path IS NULL
    OR (
      poster_storage_path ~ '^[A-Za-z0-9/._-]+$'
      AND poster_storage_path NOT LIKE '%..%'
      AND poster_storage_path NOT LIKE '%/%/%/%/%/%'
      AND poster_storage_path LIKE ('venues/' || venue_id::text || '/events/%')
    )
  ),
  CONSTRAINT events_quarantine_not_public_check CHECK (
    platform_quarantined_at IS NULL
    OR state IN ('draft', 'cancelled', 'archived')
  ),
  CONSTRAINT events_cancelled_consistency_check CHECK (
    (state = 'cancelled') = (cancelled_at IS NOT NULL)
  ),
  CONSTRAINT events_archived_consistency_check CHECK (
    (state = 'archived') = (archived_at IS NOT NULL)
  ),
  CONSTRAINT events_source_same_or_null_check CHECK (
    (source_event_id IS NULL) = (source_venue_id IS NULL)
  )
);

COMMENT ON TABLE public.events IS
  'Venue-scoped events. ends_at is exclusive. Scheduled publication is evaluated at query time. recurrence_rule is reserved and unused.';

CREATE INDEX events_venue_starts_idx
  ON public.events (venue_id, starts_at);
CREATE INDEX events_venue_state_idx
  ON public.events (venue_id, state, approval_status);
CREATE INDEX events_venue_publish_idx
  ON public.events (venue_id, publish_at);

CREATE TRIGGER events_set_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION app_private.set_updated_at();

ALTER TABLE public.events
  ADD CONSTRAINT events_source_event_fkey
  FOREIGN KEY (source_event_id, source_venue_id)
  REFERENCES public.events (id, venue_id);

CREATE TABLE public.event_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  venue_id uuid NOT NULL,
  locale text NOT NULL,
  title text NOT NULL,
  summary text,
  description text,
  cta_label text,
  updated_by uuid REFERENCES public.users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_translations_parent_fkey
    FOREIGN KEY (event_id, venue_id)
    REFERENCES public.events (id, venue_id)
    ON DELETE CASCADE,
  CONSTRAINT event_translations_parent_locale_key UNIQUE (event_id, locale),
  CONSTRAINT event_translations_locale_check CHECK (locale IN ('en', 'th')),
  CONSTRAINT event_translations_title_check CHECK (
    char_length(btrim(title)) BETWEEN 1 AND 160
  ),
  CONSTRAINT event_translations_summary_check CHECK (
    summary IS NULL OR char_length(summary) <= 280
  ),
  CONSTRAINT event_translations_description_check CHECK (
    description IS NULL OR char_length(description) <= 8000
  ),
  CONSTRAINT event_translations_cta_check CHECK (
    cta_label IS NULL OR char_length(cta_label) <= 80
  )
);

COMMENT ON TABLE public.event_translations IS
  'Entity-specific event translations. Public reads require the parent event to be publicly visible.';

CREATE TRIGGER event_translations_set_updated_at
  BEFORE UPDATE ON public.event_translations
  FOR EACH ROW
  EXECUTE FUNCTION app_private.set_updated_at();

CREATE TABLE public.event_workflow_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  venue_id uuid NOT NULL,
  action text NOT NULL,
  from_state text,
  to_state text,
  from_approval text,
  to_approval text,
  actor_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_workflow_events_parent_fkey
    FOREIGN KEY (event_id, venue_id)
    REFERENCES public.events (id, venue_id)
    ON DELETE CASCADE
);

COMMENT ON TABLE public.event_workflow_events IS
  'Append-only workflow history. No translation or rejection text.';

CREATE INDEX event_workflow_events_event_idx
  ON public.event_workflow_events (event_id, created_at DESC);

CREATE FUNCTION app_private.protect_event_quarantine()
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

CREATE TRIGGER events_protect_quarantine
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION app_private.protect_event_quarantine();

CREATE FUNCTION app_private.event_is_publicly_visible(
  p_state text,
  p_approval_status text,
  p_publish_at timestamptz,
  p_cancelled_at timestamptz,
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
    AND p_cancelled_at IS NULL
    AND p_archived_at IS NULL
    AND p_approval_status = 'approved'
    AND (
      p_state = 'published'
      OR (
        p_state = 'scheduled'
        AND p_publish_at IS NOT NULL
        AND p_publish_at <= pg_catalog.now()
      )
    );
$$;

CREATE FUNCTION app_private.event_row_is_publicly_visible(p_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.events e
    WHERE e.id = p_event_id
      AND app_private.events_module_public(e.venue_id)
      AND app_private.event_is_publicly_visible(
        e.state,
        e.approval_status,
        e.publish_at,
        e.cancelled_at,
        e.archived_at,
        e.platform_quarantined_at
      )
  );
$$;

CREATE FUNCTION app_private.may_create_event(p_venue_id uuid)
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
  IF NOT app_private.events_module_entitled(p_venue_id) THEN
    RETURN false;
  END IF;
  IF app_private.has_tenant_action_on_venue('create_content', p_venue_id)
     OR app_private.has_tenant_action_on_venue('manage_events', p_venue_id) THEN
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

CREATE FUNCTION app_private.may_edit_event_draft(p_venue_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app_private.may_create_event(p_venue_id);
$$;

CREATE FUNCTION app_private.may_submit_event(p_venue_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app_private.is_user_active()
    AND app_private.subscription_allows_tenant_writes(p_venue_id)
    AND app_private.events_module_entitled(p_venue_id)
    AND (
      app_private.has_tenant_action_on_venue('submit_content_for_approval', p_venue_id)
      OR app_private.may_create_event(p_venue_id)
    );
$$;

CREATE FUNCTION app_private.may_approve_event(p_venue_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app_private.is_user_active()
    AND app_private.subscription_allows_tenant_writes(p_venue_id)
    AND app_private.events_module_entitled(p_venue_id)
    AND (
      app_private.has_tenant_action_on_venue('approve_content', p_venue_id)
      OR app_private.platform_may_write_tenant(
        (SELECT v.business_id FROM public.venues v WHERE v.id = p_venue_id),
        p_venue_id
      )
    );
$$;

CREATE FUNCTION app_private.may_publish_event(p_venue_id uuid)
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
  IF NOT app_private.events_module_entitled(p_venue_id) THEN
    RETURN false;
  END IF;
  IF app_private.has_tenant_action_on_venue('publish_content', p_venue_id)
     OR app_private.has_tenant_action_on_venue('manage_events', p_venue_id) THEN
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
  ) AND NOT app_private.events_require_manager_approval(p_venue_id) THEN
    RETURN true;
  END IF;
  RETURN app_private.platform_may_write_tenant(
    (SELECT v.business_id FROM public.venues v WHERE v.id = p_venue_id),
    p_venue_id
  );
END;
$$;

CREATE FUNCTION app_private.may_manage_event_lifecycle(p_venue_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app_private.may_publish_event(p_venue_id);
$$;

CREATE FUNCTION app_private.may_read_event_admin(p_venue_id uuid)
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
      OR app_private.has_tenant_action_on_venue('submit_content_for_approval', p_venue_id)
      OR app_private.has_tenant_action_on_venue('approve_content', p_venue_id)
      OR app_private.has_tenant_action_on_venue('publish_content', p_venue_id)
      OR app_private.has_tenant_action_on_venue('manage_events', p_venue_id)
      OR EXISTS (
        SELECT 1
        FROM public.venue_memberships m
        WHERE m.venue_id = p_venue_id
          AND m.user_id = app_private.current_user_id()
          AND m.status = 'active'
          AND m.role IN ('staff', 'content_editor', 'venue_manager', 'business_owner')
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

CREATE FUNCTION app_private.write_event_audit(
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
    'events',
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

CREATE FUNCTION app_private.append_event_workflow(
  p_event_id uuid,
  p_venue_id uuid,
  p_action text,
  p_from_state text,
  p_to_state text,
  p_from_approval text,
  p_to_approval text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.event_workflow_events (
    event_id, venue_id, action, from_state, to_state,
    from_approval, to_approval, actor_user_id
  )
  VALUES (
    p_event_id, p_venue_id, p_action, p_from_state, p_to_state,
    p_from_approval, p_to_approval, app_private.current_user_id()
  );
END;
$$;

REVOKE ALL ON public.events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.event_translations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.event_workflow_events FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.events TO authenticated;
GRANT SELECT ON public.event_translations TO authenticated;
GRANT SELECT ON public.event_workflow_events TO authenticated;

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.event_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_translations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.event_workflow_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_workflow_events FORCE ROW LEVEL SECURITY;

CREATE POLICY events_select_member ON public.events
  FOR SELECT TO authenticated
  USING (app_private.may_read_event_admin(venue_id));

CREATE POLICY event_translations_select_member ON public.event_translations
  FOR SELECT TO authenticated
  USING (app_private.may_read_event_admin(venue_id));

CREATE POLICY event_workflow_events_select_member ON public.event_workflow_events
  FOR SELECT TO authenticated
  USING (
    app_private.has_tenant_action_on_venue('view_audit_log', venue_id)
    OR app_private.may_read_event_admin(venue_id)
  );
