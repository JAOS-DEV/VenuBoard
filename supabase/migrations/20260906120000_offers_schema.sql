-- Venue offers. Forward-only. Informational promotions only.
-- No payments, vouchers, redemption tracking or C18 copy.
-- Public reads go through RPCs. Validity is query-time.

CREATE FUNCTION app_private.offers_settings_shape_ok(p_settings jsonb)
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
    AND NOT (p_settings ? 'css')
    AND NOT (p_settings ? 'javascript')
    AND NOT (p_settings ? 'html')
    AND NOT (p_settings ? 'script');
$$;

CREATE FUNCTION app_private.protect_offers_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.module_key = 'offers'
     AND NOT app_private.offers_settings_shape_ok(NEW.settings) THEN
    RAISE EXCEPTION 'invalid offers settings'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER venue_module_settings_offers_shape
  BEFORE INSERT OR UPDATE ON public.venue_module_settings
  FOR EACH ROW
  EXECUTE FUNCTION app_private.protect_offers_settings();

CREATE FUNCTION app_private.offers_module_entitled(p_venue_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app_private.module_is_entitled(p_venue_id, 'offers');
$$;

CREATE FUNCTION app_private.offers_module_public(p_venue_id uuid)
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
      AND s.module_key = 'offers'
      AND s.is_enabled
      AND s.is_publicly_visible
      AND app_private.module_is_entitled(p_venue_id, 'offers')
      AND app_private.venue_is_publicly_visible(p_venue_id)
  );
$$;

CREATE FUNCTION app_private.offers_require_manager_approval(p_venue_id uuid)
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
        AND s.module_key = 'offers'
    ),
    false
  );
$$;

CREATE FUNCTION app_private.offers_media_path_ok(p_venue_id uuid, p_path text)
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
      AND p_path LIKE ('venues/' || p_venue_id::text || '/offers/%')
    );
$$;

CREATE FUNCTION app_private.offers_parse_venue_local(
  p_timezone text,
  p_local text
)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  v_local text;
  v_ts timestamp;
  v_instant timestamptz;
  v_roundtrip timestamp;
BEGIN
  v_local := pg_catalog.btrim(COALESCE(p_local, ''));
  IF v_local !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}(:[0-9]{2})?$' THEN
    RETURN NULL;
  END IF;

  BEGIN
    v_ts := replace(v_local, 'T', ' ')::timestamp;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;

  v_instant := v_ts AT TIME ZONE p_timezone;
  v_roundtrip := v_instant AT TIME ZONE p_timezone;
  IF v_roundtrip IS DISTINCT FROM v_ts THEN
    RETURN NULL;
  END IF;

  RETURN v_instant;
END;
$$;

CREATE TABLE public.offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES public.venues (id) ON DELETE RESTRICT,
  business_id uuid NOT NULL,
  state text NOT NULL DEFAULT 'draft',
  valid_from timestamptz NOT NULL,
  valid_until timestamptz NOT NULL,
  scheduled_for timestamptz,
  published_at timestamptz,
  submitted_by uuid REFERENCES public.users (id) ON DELETE RESTRICT,
  approved_by uuid REFERENCES public.users (id) ON DELETE RESTRICT,
  approved_at timestamptz,
  rejection_reason text,
  archived_at timestamptz,
  media_storage_path text,
  platform_quarantined_at timestamptz,
  platform_quarantine_reason text,
  platform_quarantined_by uuid REFERENCES public.users (id) ON DELETE RESTRICT,
  created_by uuid REFERENCES public.users (id) ON DELETE RESTRICT,
  updated_by uuid REFERENCES public.users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT offers_venue_business_fkey
    FOREIGN KEY (venue_id, business_id)
    REFERENCES public.venues (id, business_id),
  CONSTRAINT offers_id_venue_id_key UNIQUE (id, venue_id),
  CONSTRAINT offers_state_check CHECK (
    state IN (
      'draft',
      'pending_approval',
      'scheduled',
      'published',
      'archived'
    )
  ),
  CONSTRAINT offers_validity_check CHECK (valid_until > valid_from),
  CONSTRAINT offers_rejection_reason_check CHECK (
    rejection_reason IS NULL OR char_length(rejection_reason) BETWEEN 1 AND 500
  ),
  CONSTRAINT offers_media_path_check CHECK (
    app_private.offers_media_path_ok(venue_id, media_storage_path)
  ),
  CONSTRAINT offers_quarantine_not_public_check CHECK (
    platform_quarantined_at IS NULL
    OR state IN ('draft', 'pending_approval', 'archived')
  ),
  CONSTRAINT offers_archived_consistency_check CHECK (
    (state = 'archived') = (archived_at IS NOT NULL)
  )
);

COMMENT ON TABLE public.offers IS
  'Venue-authored informational promotions. Publication state is independent of validity. Public eligibility is evaluated at query time. No payments, vouchers or redemption tracking. Media upload is deferred; media_storage_path is a venue-scoped placeholder only.';

CREATE INDEX offers_venue_state_idx
  ON public.offers (venue_id, state, valid_from, id);
CREATE INDEX offers_venue_public_idx
  ON public.offers (venue_id, valid_from, id)
  WHERE platform_quarantined_at IS NULL AND archived_at IS NULL;
CREATE INDEX offers_venue_scheduled_idx
  ON public.offers (venue_id, scheduled_for);

CREATE TRIGGER offers_set_updated_at
  BEFORE UPDATE ON public.offers
  FOR EACH ROW
  EXECUTE FUNCTION app_private.set_updated_at();

CREATE TABLE public.offer_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL,
  venue_id uuid NOT NULL,
  locale text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  terms text NOT NULL,
  updated_by uuid REFERENCES public.users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT offer_translations_parent_fkey
    FOREIGN KEY (offer_id, venue_id)
    REFERENCES public.offers (id, venue_id)
    ON DELETE RESTRICT,
  CONSTRAINT offer_translations_parent_locale_key UNIQUE (offer_id, locale),
  CONSTRAINT offer_translations_locale_check CHECK (locale IN ('en', 'th')),
  CONSTRAINT offer_translations_title_check CHECK (
    char_length(btrim(title)) BETWEEN 1 AND 120
  ),
  CONSTRAINT offer_translations_description_check CHECK (
    char_length(btrim(description)) BETWEEN 1 AND 2000
  ),
  CONSTRAINT offer_translations_terms_check CHECK (
    char_length(btrim(terms)) BETWEEN 1 AND 4000
  )
);

COMMENT ON TABLE public.offer_translations IS
  'Entity-specific offer translations. Public reads require the parent offer to be publicly visible.';

CREATE TRIGGER offer_translations_set_updated_at
  BEFORE UPDATE ON public.offer_translations
  FOR EACH ROW
  EXECUTE FUNCTION app_private.set_updated_at();

CREATE TABLE public.offer_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL,
  venue_id uuid NOT NULL,
  action text NOT NULL,
  from_state text,
  to_state text,
  actor_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT offer_events_parent_fkey
    FOREIGN KEY (offer_id, venue_id)
    REFERENCES public.offers (id, venue_id)
    ON DELETE RESTRICT
);

COMMENT ON TABLE public.offer_events IS
  'Append-only offer workflow history. No titles, descriptions, terms or rejection text.';

CREATE INDEX offer_events_offer_idx
  ON public.offer_events (offer_id, created_at DESC);

CREATE FUNCTION app_private.reject_offer_history_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'offer history is append-only'
    USING ERRCODE = '25006';
END;
$$;

CREATE TRIGGER offer_events_no_update
  BEFORE UPDATE OR DELETE ON public.offer_events
  FOR EACH ROW
  EXECUTE FUNCTION app_private.reject_offer_history_mutation();

CREATE FUNCTION app_private.protect_offer_quarantine()
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

CREATE TRIGGER offers_protect_quarantine
  BEFORE UPDATE ON public.offers
  FOR EACH ROW
  EXECUTE FUNCTION app_private.protect_offer_quarantine();

CREATE FUNCTION app_private.protect_offer_keys()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND (
       NEW.id IS DISTINCT FROM OLD.id
       OR NEW.venue_id IS DISTINCT FROM OLD.venue_id
       OR NEW.business_id IS DISTINCT FROM OLD.business_id
     ) THEN
    RAISE EXCEPTION 'offer keys are immutable'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER offers_protect_keys
  BEFORE UPDATE ON public.offers
  FOR EACH ROW
  EXECUTE FUNCTION app_private.protect_offer_keys();

CREATE FUNCTION app_private.offer_is_publicly_visible(
  p_state text,
  p_scheduled_for timestamptz,
  p_published_at timestamptz,
  p_valid_from timestamptz,
  p_valid_until timestamptz,
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
    AND p_valid_from <= pg_catalog.now()
    AND pg_catalog.now() < p_valid_until
    AND COALESCE(p_published_at, p_scheduled_for, pg_catalog.now())
      <= pg_catalog.now();
$$;

CREATE FUNCTION app_private.offer_row_is_publicly_visible(p_offer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.offers o
    WHERE o.id = p_offer_id
      AND app_private.offers_module_public(o.venue_id)
      AND app_private.offer_is_publicly_visible(
        o.state,
        o.scheduled_for,
        o.published_at,
        o.valid_from,
        o.valid_until,
        o.archived_at,
        o.platform_quarantined_at
      )
      AND EXISTS (
        SELECT 1
        FROM public.offer_translations t
        WHERE t.offer_id = o.id
          AND t.locale = 'en'
      )
  );
$$;

CREATE FUNCTION app_private.may_create_offer(p_venue_id uuid)
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
  IF NOT app_private.offers_module_entitled(p_venue_id) THEN
    RETURN false;
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.venue_module_settings s
    WHERE s.venue_id = p_venue_id
      AND s.module_key = 'offers'
      AND NOT s.is_enabled
  ) THEN
    RETURN false;
  END IF;
  IF app_private.has_tenant_action_on_venue('create_content', p_venue_id) THEN
    RETURN true;
  END IF;
  RETURN app_private.platform_may_write_tenant(
    (SELECT v.business_id FROM public.venues v WHERE v.id = p_venue_id),
    p_venue_id
  );
END;
$$;

CREATE FUNCTION app_private.may_submit_offer(p_venue_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app_private.is_user_active()
    AND app_private.subscription_allows_tenant_writes(p_venue_id)
    AND app_private.offers_module_entitled(p_venue_id)
    AND (
      app_private.has_tenant_action_on_venue(
        'submit_content_for_approval',
        p_venue_id
      )
      OR app_private.may_create_offer(p_venue_id)
    );
$$;

CREATE FUNCTION app_private.may_approve_offer(p_venue_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app_private.is_user_active()
    AND app_private.subscription_allows_tenant_writes(p_venue_id)
    AND app_private.offers_module_entitled(p_venue_id)
    AND (
      app_private.has_tenant_action_on_venue('approve_content', p_venue_id)
      OR app_private.platform_may_write_tenant(
        (SELECT v.business_id FROM public.venues v WHERE v.id = p_venue_id),
        p_venue_id
      )
    );
$$;

CREATE FUNCTION app_private.may_publish_offer(p_venue_id uuid)
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
  IF NOT app_private.offers_module_entitled(p_venue_id) THEN
    RETURN false;
  END IF;
  IF app_private.has_tenant_action_on_venue('publish_content', p_venue_id)
     OR app_private.has_tenant_action_on_venue('manage_offers', p_venue_id) THEN
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
  ) AND NOT app_private.offers_require_manager_approval(p_venue_id) THEN
    RETURN true;
  END IF;
  RETURN app_private.platform_may_write_tenant(
    (SELECT v.business_id FROM public.venues v WHERE v.id = p_venue_id),
    p_venue_id
  );
END;
$$;

CREATE FUNCTION app_private.may_read_offer_admin(p_venue_id uuid)
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
      OR app_private.has_tenant_action_on_venue('manage_offers', p_venue_id)
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

CREATE FUNCTION app_private.write_offer_audit(
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
    'offers',
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

CREATE FUNCTION app_private.append_offer_event(
  p_offer_id uuid,
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
  INSERT INTO public.offer_events (
    offer_id, venue_id, action, from_state, to_state, actor_user_id
  )
  VALUES (
    p_offer_id,
    p_venue_id,
    p_action,
    p_from_state,
    p_to_state,
    app_private.current_user_id()
  );
END;
$$;

REVOKE ALL ON public.offers FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.offer_translations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.offer_events FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.offers TO authenticated;
GRANT SELECT ON public.offer_translations TO authenticated;
GRANT SELECT ON public.offer_events TO authenticated;

ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers FORCE ROW LEVEL SECURITY;
ALTER TABLE public.offer_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_translations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.offer_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_events FORCE ROW LEVEL SECURITY;

CREATE POLICY offers_select_member ON public.offers
  FOR SELECT TO authenticated
  USING (app_private.may_read_offer_admin(venue_id));

CREATE POLICY offer_translations_select_member
  ON public.offer_translations
  FOR SELECT TO authenticated
  USING (app_private.may_read_offer_admin(venue_id));

CREATE POLICY offer_events_select_member ON public.offer_events
  FOR SELECT TO authenticated
  USING (
    app_private.has_tenant_action_on_venue('view_audit_log', venue_id)
    OR app_private.may_read_offer_admin(venue_id)
  );

REVOKE ALL ON FUNCTION app_private.offers_settings_shape_ok(jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.protect_offers_settings()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.offers_module_entitled(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.offers_module_public(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.offers_require_manager_approval(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.offers_media_path_ok(uuid, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.offers_parse_venue_local(text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.reject_offer_history_mutation()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.protect_offer_quarantine()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.protect_offer_keys()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.offer_is_publicly_visible(
  text, timestamptz, timestamptz, timestamptz, timestamptz, timestamptz, timestamptz
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.offer_row_is_publicly_visible(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.may_create_offer(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.may_submit_offer(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.may_approve_offer(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.may_publish_offer(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.may_read_offer_admin(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.write_offer_audit(
  text, uuid, uuid, uuid, text, jsonb, jsonb
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.append_offer_event(
  uuid, uuid, text, text, text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION app_private.may_read_offer_admin(uuid)
  TO authenticated;
