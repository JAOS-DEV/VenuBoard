-- Venue public profile, contacts, opening hours and publication helpers.
-- Forward-only. Reuses manage_venue / manage_branding. Does not invent actions.
-- Public hours and contacts are read through RPCs so exception notes stay private.

ALTER TABLE public.venues
  ADD COLUMN opening_hours_mode text NOT NULL DEFAULT 'unknown',
  ADD CONSTRAINT venues_opening_hours_mode_check
    CHECK (opening_hours_mode IN ('unknown', 'scheduled'));

COMMENT ON COLUMN public.venues.opening_hours_mode IS
  'unknown = no weekly schedule provided. scheduled = every ISO weekday is closed or has 1-4 intervals.';

ALTER TABLE public.venue_translations
  ADD COLUMN directions text,
  ADD CONSTRAINT venue_translations_name_len_check
    CHECK (name IS NULL OR char_length(name) BETWEEN 1 AND 80),
  ADD CONSTRAINT venue_translations_tagline_len_check
    CHECK (tagline IS NULL OR char_length(tagline) BETWEEN 1 AND 160),
  ADD CONSTRAINT venue_translations_description_len_check
    CHECK (description IS NULL OR char_length(description) BETWEEN 1 AND 4000),
  ADD CONSTRAINT venue_translations_directions_len_check
    CHECK (directions IS NULL OR char_length(directions) BETWEEN 1 AND 1000);

CREATE OR REPLACE FUNCTION app_private.protect_venue_platform_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF CURRENT_USER IN ('anon', 'authenticated')
     AND NOT app_private.is_platform_admin() THEN
    IF NEW.platform_quarantined_at IS DISTINCT FROM OLD.platform_quarantined_at
       OR NEW.platform_quarantine_reason IS DISTINCT FROM OLD.platform_quarantine_reason
       OR NEW.platform_quarantined_by IS DISTINCT FROM OLD.platform_quarantined_by THEN
      RAISE EXCEPTION 'quarantine columns are platform-write-only'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.publication_state IS DISTINCT FROM OLD.publication_state
       AND NEW.publication_state = 'unpublished_by_platform' THEN
      RAISE EXCEPTION 'unpublished_by_platform is a platform-only publication state'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.classification_locked_by_platform IS DISTINCT FROM OLD.classification_locked_by_platform THEN
      RAISE EXCEPTION 'only the platform may lock content classification'
        USING ERRCODE = '42501';
    END IF;

    IF OLD.classification_locked_by_platform
       AND NEW.content_classification IS DISTINCT FROM OLD.content_classification THEN
      RAISE EXCEPTION 'content classification is locked by the platform'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF CURRENT_USER IN ('anon', 'authenticated')
     AND app_private.is_platform_admin()
     AND NOT app_private.platform_may_write_tenant(NEW.business_id, NEW.id) THEN
    IF NEW.name IS DISTINCT FROM OLD.name
       OR NEW.slug IS DISTINCT FROM OLD.slug
       OR NEW.timezone IS DISTINCT FROM OLD.timezone
       OR NEW.default_locale IS DISTINCT FROM OLD.default_locale
       OR NEW.address_line1 IS DISTINCT FROM OLD.address_line1
       OR NEW.address_line2 IS DISTINCT FROM OLD.address_line2
       OR NEW.city IS DISTINCT FROM OLD.city
       OR NEW.province IS DISTINCT FROM OLD.province
       OR NEW.postal_code IS DISTINCT FROM OLD.postal_code
       OR NEW.country IS DISTINCT FROM OLD.country
       OR NEW.latitude IS DISTINCT FROM OLD.latitude
       OR NEW.longitude IS DISTINCT FROM OLD.longitude
       OR NEW.directions_url IS DISTINCT FROM OLD.directions_url
       OR NEW.publication_state IS DISTINCT FROM OLD.publication_state
       OR NEW.opening_hours_mode IS DISTINCT FROM OLD.opening_hours_mode THEN
      RAISE EXCEPTION 'tenant venue profile fields require a support write session (C19)'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TABLE public.venue_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES public.venues (id) ON DELETE CASCADE,
  contact_type text NOT NULL,
  value text NOT NULL,
  is_public boolean NOT NULL DEFAULT true,
  sort_order smallint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.users (id) ON DELETE RESTRICT,
  CONSTRAINT venue_contacts_type_check CHECK (
    contact_type IN ('phone', 'email', 'website')
  ),
  CONSTRAINT venue_contacts_value_len_check CHECK (
    char_length(value) BETWEEN 3 AND 200
  ),
  CONSTRAINT venue_contacts_sort_check CHECK (sort_order BETWEEN 1 AND 9),
  CONSTRAINT venue_contacts_id_venue_id_key UNIQUE (id, venue_id),
  CONSTRAINT venue_contacts_venue_type_key UNIQUE (venue_id, contact_type)
);

COMMENT ON TABLE public.venue_contacts IS
  'Optional public business contacts. Never copied from private owner accounts. Line/WhatsApp remain deferred with social_links.';

CREATE INDEX venue_contacts_venue_idx ON public.venue_contacts (venue_id);

CREATE TRIGGER venue_contacts_set_updated_at
  BEFORE UPDATE ON public.venue_contacts
  FOR EACH ROW
  EXECUTE FUNCTION app_private.set_updated_at();

CREATE TABLE public.venue_opening_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES public.venues (id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL,
  sort_order smallint NOT NULL,
  opens_local time NOT NULL,
  closes_local time NOT NULL,
  closes_next_day boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT venue_opening_hours_day_check CHECK (day_of_week BETWEEN 1 AND 7),
  CONSTRAINT venue_opening_hours_sort_check CHECK (sort_order BETWEEN 1 AND 4),
  CONSTRAINT venue_opening_hours_id_venue_id_key UNIQUE (id, venue_id),
  CONSTRAINT venue_opening_hours_day_sort_key UNIQUE (venue_id, day_of_week, sort_order),
  CONSTRAINT venue_opening_hours_span_check CHECK (
    closes_next_day OR closes_local > opens_local
  )
);

COMMENT ON TABLE public.venue_opening_hours IS
  'Weekly open intervals in venue-local wall-clock time. day_of_week is ISO-8601 (Monday=1, Sunday=7). Intervals are start-inclusive and end-exclusive. closes_next_day encodes overnight service.';

CREATE INDEX venue_opening_hours_venue_day_idx
  ON public.venue_opening_hours (venue_id, day_of_week, sort_order);

CREATE TRIGGER venue_opening_hours_set_updated_at
  BEFORE UPDATE ON public.venue_opening_hours
  FOR EACH ROW
  EXECUTE FUNCTION app_private.set_updated_at();

CREATE TABLE public.venue_closed_weekdays (
  venue_id uuid NOT NULL REFERENCES public.venues (id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT venue_closed_weekdays_day_check CHECK (day_of_week BETWEEN 1 AND 7),
  CONSTRAINT venue_closed_weekdays_pkey PRIMARY KEY (venue_id, day_of_week)
);

COMMENT ON TABLE public.venue_closed_weekdays IS
  'Explicitly closed ISO weekdays. Distinct from unknown (no weekly rows) and from open intervals.';

CREATE TABLE public.venue_hours_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES public.venues (id) ON DELETE CASCADE,
  exception_date date NOT NULL,
  is_closed boolean NOT NULL,
  internal_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.users (id) ON DELETE RESTRICT,
  CONSTRAINT venue_hours_exceptions_note_len_check CHECK (
    internal_note IS NULL OR char_length(internal_note) BETWEEN 1 AND 200
  ),
  CONSTRAINT venue_hours_exceptions_id_venue_id_key UNIQUE (id, venue_id),
  CONSTRAINT venue_hours_exceptions_venue_date_key UNIQUE (venue_id, exception_date)
);

COMMENT ON TABLE public.venue_hours_exceptions IS
  'Date-specific replacement of that local calendar date. internal_note is private and never returned by public RPCs.';

CREATE INDEX venue_hours_exceptions_venue_date_idx
  ON public.venue_hours_exceptions (venue_id, exception_date);

CREATE TRIGGER venue_hours_exceptions_set_updated_at
  BEFORE UPDATE ON public.venue_hours_exceptions
  FOR EACH ROW
  EXECUTE FUNCTION app_private.set_updated_at();

CREATE TABLE public.venue_hours_exception_intervals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exception_id uuid NOT NULL,
  venue_id uuid NOT NULL,
  sort_order smallint NOT NULL,
  opens_local time NOT NULL,
  closes_local time NOT NULL,
  closes_next_day boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT venue_hours_exception_intervals_sort_check
    CHECK (sort_order BETWEEN 1 AND 4),
  CONSTRAINT venue_hours_exception_intervals_span_check CHECK (
    closes_next_day OR closes_local > opens_local
  ),
  CONSTRAINT venue_hours_exception_intervals_id_venue_id_key UNIQUE (id, venue_id),
  CONSTRAINT venue_hours_exception_intervals_parent_sort_key
    UNIQUE (exception_id, sort_order),
  CONSTRAINT venue_hours_exception_intervals_parent_venue_fkey
    FOREIGN KEY (exception_id, venue_id)
    REFERENCES public.venue_hours_exceptions (id, venue_id)
    ON DELETE CASCADE
);

CREATE INDEX venue_hours_exception_intervals_venue_idx
  ON public.venue_hours_exception_intervals (venue_id, exception_id);

CREATE FUNCTION app_private.venue_minutes_of_time(p_time time)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT (EXTRACT(HOUR FROM p_time)::integer * 60)
    + EXTRACT(MINUTE FROM p_time)::integer;
$$;

CREATE FUNCTION app_private.venue_hours_interval_range(
  p_day smallint,
  p_opens time,
  p_closes time,
  p_next_day boolean
)
RETURNS int4range
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  v_start integer;
  v_end integer;
BEGIN
  IF p_day < 1 OR p_day > 7 THEN
    RETURN NULL;
  END IF;
  v_start := ((p_day - 1) * 1440) + app_private.venue_minutes_of_time(p_opens);
  v_end := ((p_day - 1) * 1440) + app_private.venue_minutes_of_time(p_closes);
  IF p_next_day THEN
    v_end := v_end + 1440;
  END IF;
  IF v_end <= v_start THEN
    RETURN NULL;
  END IF;
  RETURN int4range(v_start, v_end, '[)');
END;
$$;

CREATE FUNCTION app_private.venue_hours_ranges_conflict(p_ranges int4range[])
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  i integer;
  j integer;
  a int4range;
  b int4range;
  a2 int4range;
  b2 int4range;
BEGIN
  IF p_ranges IS NULL THEN
    RETURN false;
  END IF;
  FOR i IN 1 .. COALESCE(pg_catalog.array_length(p_ranges, 1), 0) LOOP
    a := p_ranges[i];
    IF a IS NULL THEN
      RETURN true;
    END IF;
    a2 := int4range(lower(a) + 10080, upper(a) + 10080, '[)');
    FOR j IN i + 1 .. COALESCE(pg_catalog.array_length(p_ranges, 1), 0) LOOP
      b := p_ranges[j];
      IF b IS NULL THEN
        RETURN true;
      END IF;
      b2 := int4range(lower(b) + 10080, upper(b) + 10080, '[)');
      IF a && b OR a && b2 OR a2 && b THEN
        RETURN true;
      END IF;
    END LOOP;
  END LOOP;
  RETURN false;
END;
$$;

CREATE FUNCTION app_private.may_manage_venue_profile(p_venue_id uuid)
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
  IF app_private.has_tenant_action_on_venue('manage_venue', p_venue_id) THEN
    RETURN true;
  END IF;
  RETURN app_private.platform_may_write_tenant(
    (SELECT v.business_id FROM public.venues v WHERE v.id = p_venue_id),
    p_venue_id
  );
END;
$$;

CREATE FUNCTION app_private.may_manage_venue_branding(p_venue_id uuid)
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
  IF app_private.has_tenant_action_on_venue('manage_branding', p_venue_id) THEN
    RETURN true;
  END IF;
  RETURN app_private.platform_may_write_tenant(
    (SELECT v.business_id FROM public.venues v WHERE v.id = p_venue_id),
    p_venue_id
  );
END;
$$;

CREATE FUNCTION app_private.may_preview_venue(p_venue_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app_private.is_user_active()
    AND (
      app_private.is_tenant_of_venue(p_venue_id)
      OR app_private.has_platform_action('manage_platform_tenants')
      OR app_private.platform_may_read_tenant(
        (SELECT v.business_id FROM public.venues v WHERE v.id = p_venue_id),
        p_venue_id
      )
    );
$$;

CREATE FUNCTION app_private.write_venue_profile_audit(
  p_action text,
  p_business_id uuid,
  p_venue_id uuid,
  p_summary text,
  p_previous jsonb,
  p_resulting jsonb,
  p_fields text[]
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
    'venues',
    p_venue_id,
    p_summary,
    p_previous,
    p_resulting,
    'success',
    app_private.audit_environment(),
    pg_catalog.jsonb_build_object('changed_fields', to_jsonb(p_fields))
  );
END;
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.venue_contacts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.venue_opening_hours
  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.venue_closed_weekdays
  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.venue_hours_exceptions
  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.venue_hours_exception_intervals
  TO authenticated;

ALTER TABLE public.venue_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_contacts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.venue_opening_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_opening_hours FORCE ROW LEVEL SECURITY;
ALTER TABLE public.venue_closed_weekdays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_closed_weekdays FORCE ROW LEVEL SECURITY;
ALTER TABLE public.venue_hours_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_hours_exceptions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.venue_hours_exception_intervals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_hours_exception_intervals FORCE ROW LEVEL SECURITY;

CREATE POLICY venue_contacts_select_member ON public.venue_contacts
  FOR SELECT TO authenticated
  USING (
    app_private.is_tenant_of_venue(venue_id)
    OR app_private.has_platform_action('manage_platform_tenants')
    OR app_private.platform_may_read_tenant(
      app_private.venue_business_id(venue_id), venue_id
    )
  );

CREATE POLICY venue_contacts_insert_manager ON public.venue_contacts
  FOR INSERT TO authenticated
  WITH CHECK (app_private.may_manage_venue_profile(venue_id));

CREATE POLICY venue_contacts_update_manager ON public.venue_contacts
  FOR UPDATE TO authenticated
  USING (app_private.may_manage_venue_profile(venue_id))
  WITH CHECK (app_private.may_manage_venue_profile(venue_id));

CREATE POLICY venue_contacts_delete_manager ON public.venue_contacts
  FOR DELETE TO authenticated
  USING (app_private.may_manage_venue_profile(venue_id));

CREATE POLICY venue_opening_hours_select_member ON public.venue_opening_hours
  FOR SELECT TO authenticated
  USING (
    app_private.is_tenant_of_venue(venue_id)
    OR app_private.has_platform_action('manage_platform_tenants')
    OR app_private.platform_may_read_tenant(
      app_private.venue_business_id(venue_id), venue_id
    )
  );

CREATE POLICY venue_opening_hours_insert_manager ON public.venue_opening_hours
  FOR INSERT TO authenticated
  WITH CHECK (app_private.may_manage_venue_profile(venue_id));

CREATE POLICY venue_opening_hours_update_manager ON public.venue_opening_hours
  FOR UPDATE TO authenticated
  USING (app_private.may_manage_venue_profile(venue_id))
  WITH CHECK (app_private.may_manage_venue_profile(venue_id));

CREATE POLICY venue_opening_hours_delete_manager ON public.venue_opening_hours
  FOR DELETE TO authenticated
  USING (app_private.may_manage_venue_profile(venue_id));

CREATE POLICY venue_closed_weekdays_select_member ON public.venue_closed_weekdays
  FOR SELECT TO authenticated
  USING (
    app_private.is_tenant_of_venue(venue_id)
    OR app_private.has_platform_action('manage_platform_tenants')
    OR app_private.platform_may_read_tenant(
      app_private.venue_business_id(venue_id), venue_id
    )
  );

CREATE POLICY venue_closed_weekdays_insert_manager ON public.venue_closed_weekdays
  FOR INSERT TO authenticated
  WITH CHECK (app_private.may_manage_venue_profile(venue_id));

CREATE POLICY venue_closed_weekdays_update_manager ON public.venue_closed_weekdays
  FOR UPDATE TO authenticated
  USING (app_private.may_manage_venue_profile(venue_id))
  WITH CHECK (app_private.may_manage_venue_profile(venue_id));

CREATE POLICY venue_closed_weekdays_delete_manager ON public.venue_closed_weekdays
  FOR DELETE TO authenticated
  USING (app_private.may_manage_venue_profile(venue_id));

CREATE POLICY venue_hours_exceptions_select_member
  ON public.venue_hours_exceptions
  FOR SELECT TO authenticated
  USING (
    app_private.is_tenant_of_venue(venue_id)
    OR app_private.has_platform_action('manage_platform_tenants')
    OR app_private.platform_may_read_tenant(
      app_private.venue_business_id(venue_id), venue_id
    )
  );

CREATE POLICY venue_hours_exceptions_insert_manager
  ON public.venue_hours_exceptions
  FOR INSERT TO authenticated
  WITH CHECK (app_private.may_manage_venue_profile(venue_id));

CREATE POLICY venue_hours_exceptions_update_manager
  ON public.venue_hours_exceptions
  FOR UPDATE TO authenticated
  USING (app_private.may_manage_venue_profile(venue_id))
  WITH CHECK (app_private.may_manage_venue_profile(venue_id));

CREATE POLICY venue_hours_exceptions_delete_manager
  ON public.venue_hours_exceptions
  FOR DELETE TO authenticated
  USING (app_private.may_manage_venue_profile(venue_id));

CREATE POLICY venue_hours_exception_intervals_select_member
  ON public.venue_hours_exception_intervals
  FOR SELECT TO authenticated
  USING (
    app_private.is_tenant_of_venue(venue_id)
    OR app_private.has_platform_action('manage_platform_tenants')
    OR app_private.platform_may_read_tenant(
      app_private.venue_business_id(venue_id), venue_id
    )
  );

CREATE POLICY venue_hours_exception_intervals_insert_manager
  ON public.venue_hours_exception_intervals
  FOR INSERT TO authenticated
  WITH CHECK (app_private.may_manage_venue_profile(venue_id));

CREATE POLICY venue_hours_exception_intervals_update_manager
  ON public.venue_hours_exception_intervals
  FOR UPDATE TO authenticated
  USING (app_private.may_manage_venue_profile(venue_id))
  WITH CHECK (app_private.may_manage_venue_profile(venue_id));

CREATE POLICY venue_hours_exception_intervals_delete_manager
  ON public.venue_hours_exception_intervals
  FOR DELETE TO authenticated
  USING (app_private.may_manage_venue_profile(venue_id));

REVOKE ALL ON FUNCTION app_private.venue_minutes_of_time(time)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.venue_hours_interval_range(
  smallint, time, time, boolean
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.venue_hours_ranges_conflict(int4range[])
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.may_manage_venue_profile(uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.may_manage_venue_branding(uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.may_preview_venue(uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.write_venue_profile_audit(
  text, uuid, uuid, text, jsonb, jsonb, text[]
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION app_private.may_manage_venue_profile(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.may_manage_venue_branding(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.may_preview_venue(uuid)
  TO authenticated;

GRANT ALL ON TABLE public.venue_contacts TO service_role;
GRANT ALL ON TABLE public.venue_opening_hours TO service_role;
GRANT ALL ON TABLE public.venue_closed_weekdays TO service_role;
GRANT ALL ON TABLE public.venue_hours_exceptions TO service_role;
GRANT ALL ON TABLE public.venue_hours_exception_intervals TO service_role;

CREATE FUNCTION app_private.enforce_venue_opening_hours_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_venue uuid := COALESCE(NEW.venue_id, OLD.venue_id);
  v_ranges int4range[] := ARRAY[]::int4range[];
  v_row public.venue_opening_hours%ROWTYPE;
  v_range int4range;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.venue_closed_weekdays c
    JOIN public.venue_opening_hours h
      ON h.venue_id = c.venue_id AND h.day_of_week = c.day_of_week
    WHERE c.venue_id = v_venue
  ) THEN
    RAISE EXCEPTION 'closed weekdays cannot also have open intervals'
      USING ERRCODE = '23514';
  END IF;

  FOR v_row IN
    SELECT * FROM public.venue_opening_hours h WHERE h.venue_id = v_venue
  LOOP
    v_range := app_private.venue_hours_interval_range(
      v_row.day_of_week, v_row.opens_local, v_row.closes_local,
      v_row.closes_next_day
    );
    IF v_range IS NULL THEN
      RAISE EXCEPTION 'invalid opening-hours interval'
        USING ERRCODE = '23514';
    END IF;
    v_ranges := v_ranges || v_range;
  END LOOP;

  IF app_private.venue_hours_ranges_conflict(v_ranges) THEN
    RAISE EXCEPTION 'opening hours overlap'
      USING ERRCODE = '23P01';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE CONSTRAINT TRIGGER venue_opening_hours_integrity
  AFTER INSERT OR UPDATE OR DELETE ON public.venue_opening_hours
  DEFERRABLE INITIALLY IMMEDIATE
  FOR EACH ROW
  EXECUTE FUNCTION app_private.enforce_venue_opening_hours_integrity();

CREATE CONSTRAINT TRIGGER venue_closed_weekdays_integrity
  AFTER INSERT OR UPDATE OR DELETE ON public.venue_closed_weekdays
  DEFERRABLE INITIALLY IMMEDIATE
  FOR EACH ROW
  EXECUTE FUNCTION app_private.enforce_venue_opening_hours_integrity();

REVOKE ALL ON FUNCTION app_private.enforce_venue_opening_hours_integrity()
  FROM PUBLIC, anon, authenticated;
