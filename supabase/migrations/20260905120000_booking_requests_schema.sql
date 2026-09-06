-- Booking request enquiries. Forward-only. No enum types. RLS is
-- authoritative. Anonymous customers never SELECT these tables.
-- This is a request workflow, not a reservation engine.

CREATE FUNCTION app_private.booking_settings_shape_ok(p_settings jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT
    jsonb_typeof(p_settings) = 'object'
    AND COALESCE((p_settings->>'accepting_enquiries')::boolean, true)
      IN (true, false)
    AND COALESCE((p_settings->>'min_party_size')::integer, 1)
      BETWEEN 1 AND 20
    AND COALESCE((p_settings->>'max_party_size')::integer, 12)
      BETWEEN 1 AND 50
    AND COALESCE((p_settings->>'min_party_size')::integer, 1)
      <= COALESCE((p_settings->>'max_party_size')::integer, 12)
    AND COALESCE((p_settings->>'horizon_days')::integer, 90)
      BETWEEN 1 AND 365
    AND COALESCE((p_settings->>'lead_time_minutes')::integer, 60)
      BETWEEN 0 AND 10080
    AND char_length(COALESCE(p_settings->>'instructions_en', '')) <= 500
    AND char_length(COALESCE(p_settings->>'instructions_th', '')) <= 500
    AND NOT (p_settings ? 'css')
    AND NOT (p_settings ? 'javascript')
    AND NOT (p_settings ? 'html')
    AND NOT (p_settings ? 'script');
$$;

CREATE FUNCTION app_private.protect_booking_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.module_key = 'booking_requests'
     AND NOT app_private.booking_settings_shape_ok(NEW.settings) THEN
    RAISE EXCEPTION 'invalid booking settings'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER venue_module_settings_booking_shape
  BEFORE INSERT OR UPDATE ON public.venue_module_settings
  FOR EACH ROW
  EXECUTE FUNCTION app_private.protect_booking_settings();

CREATE FUNCTION app_private.booking_module_entitled(p_venue_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app_private.module_is_entitled(p_venue_id, 'booking_requests');
$$;

CREATE FUNCTION app_private.booking_public_intake_open(p_venue_id uuid)
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
      AND s.module_key = 'booking_requests'
      AND s.is_enabled
      AND s.is_publicly_visible
      AND COALESCE((s.settings->>'accepting_enquiries')::boolean, true)
      AND app_private.module_is_entitled(p_venue_id, 'booking_requests')
      AND app_private.venue_is_publicly_visible(p_venue_id)
  );
$$;

CREATE TABLE public.booking_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES public.venues (id) ON DELETE RESTRICT,
  business_id uuid NOT NULL,
  locale text NOT NULL DEFAULT 'en',
  party_size integer NOT NULL,
  requested_for timestamptz NOT NULL,
  state text NOT NULL DEFAULT 'new',
  closure_outcome text,
  row_version integer NOT NULL DEFAULT 1,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES public.users (id) ON DELETE RESTRICT,
  closed_at timestamptz,
  closed_by uuid REFERENCES public.users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_requests_venue_business_fkey
    FOREIGN KEY (venue_id, business_id)
    REFERENCES public.venues (id, business_id),
  CONSTRAINT booking_requests_id_venue_id_key UNIQUE (id, venue_id),
  CONSTRAINT booking_requests_locale_check CHECK (locale IN ('en', 'th')),
  CONSTRAINT booking_requests_party_size_check CHECK (
    party_size BETWEEN 1 AND 50
  ),
  CONSTRAINT booking_requests_state_check CHECK (
    state IN ('new', 'in_review', 'closed')
  ),
  CONSTRAINT booking_requests_outcome_check CHECK (
    (
      state <> 'closed'
      AND closure_outcome IS NULL
      AND closed_at IS NULL
      AND closed_by IS NULL
    )
    OR (
      state = 'closed'
      AND closure_outcome IN (
        'handled',
        'declined',
        'duplicate',
        'spam',
        'withdrawn'
      )
      AND closed_at IS NOT NULL
    )
  ),
  CONSTRAINT booking_requests_row_version_check CHECK (row_version >= 1)
);

COMMENT ON TABLE public.booking_requests IS
  'Private venue-scoped visit enquiries. Not reservations. Customer contact lives in booking_request_contacts. Retention/redaction after close is OQ-22; no cleanup job is claimed.';

CREATE INDEX booking_requests_venue_state_idx
  ON public.booking_requests (venue_id, state, requested_for DESC, id DESC);
CREATE INDEX booking_requests_venue_created_idx
  ON public.booking_requests (venue_id, created_at DESC, id DESC);

CREATE TRIGGER booking_requests_set_updated_at
  BEFORE UPDATE ON public.booking_requests
  FOR EACH ROW
  EXECUTE FUNCTION app_private.set_updated_at();

CREATE FUNCTION app_private.protect_booking_request_keys()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND (
       NEW.venue_id IS DISTINCT FROM OLD.venue_id
       OR NEW.business_id IS DISTINCT FROM OLD.business_id
       OR NEW.id IS DISTINCT FROM OLD.id
     ) THEN
    RAISE EXCEPTION 'booking tenant keys are immutable'
      USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    NEW.row_version := OLD.row_version + 1;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER booking_requests_protect_keys
  BEFORE UPDATE ON public.booking_requests
  FOR EACH ROW
  EXECUTE FUNCTION app_private.protect_booking_request_keys();

CREATE TABLE public.booking_request_contacts (
  booking_request_id uuid PRIMARY KEY,
  venue_id uuid NOT NULL,
  customer_display_name text NOT NULL,
  customer_email text NOT NULL,
  customer_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_request_contacts_parent_fkey
    FOREIGN KEY (booking_request_id, venue_id)
    REFERENCES public.booking_requests (id, venue_id)
    ON DELETE RESTRICT,
  CONSTRAINT booking_request_contacts_name_check CHECK (
    char_length(btrim(customer_display_name)) BETWEEN 1 AND 80
  ),
  CONSTRAINT booking_request_contacts_email_check CHECK (
    char_length(btrim(customer_email)) BETWEEN 3 AND 254
    AND customer_email = lower(customer_email)
    AND customer_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ),
  CONSTRAINT booking_request_contacts_message_check CHECK (
    customer_message IS NULL
    OR char_length(btrim(customer_message)) BETWEEN 1 AND 500
  )
);

COMMENT ON TABLE public.booking_request_contacts IS
  'Restricted enquiry contact fields. Readable only with view_booking_customer_details (C11 for platform).';

CREATE FUNCTION app_private.protect_booking_contact_keys()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND (
       NEW.booking_request_id IS DISTINCT FROM OLD.booking_request_id
       OR NEW.venue_id IS DISTINCT FROM OLD.venue_id
     ) THEN
    RAISE EXCEPTION 'booking tenant keys are immutable'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER booking_request_contacts_protect_keys
  BEFORE UPDATE ON public.booking_request_contacts
  FOR EACH ROW
  EXECUTE FUNCTION app_private.protect_booking_contact_keys();

CREATE TABLE public.booking_request_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_request_id uuid NOT NULL,
  venue_id uuid NOT NULL,
  action text NOT NULL,
  from_state text,
  to_state text,
  closure_outcome text,
  actor_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_request_events_parent_fkey
    FOREIGN KEY (booking_request_id, venue_id)
    REFERENCES public.booking_requests (id, venue_id)
    ON DELETE RESTRICT,
  CONSTRAINT booking_request_events_action_check CHECK (
    action IN ('created', 'reviewed', 'closed', 'reopened')
  )
);

COMMENT ON TABLE public.booking_request_events IS
  'Append-only enquiry workflow history. Identifiers and state only — never names, emails or messages.';

CREATE INDEX booking_request_events_parent_idx
  ON public.booking_request_events (booking_request_id, created_at DESC);

CREATE FUNCTION app_private.reject_booking_history_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'booking history is append-only'
    USING ERRCODE = '25006';
END;
$$;

CREATE TRIGGER booking_request_events_no_update
  BEFORE UPDATE OR DELETE ON public.booking_request_events
  FOR EACH ROW
  EXECUTE FUNCTION app_private.reject_booking_history_mutation();

CREATE TABLE public.booking_intake_idempotency (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES public.venues (id) ON DELETE RESTRICT,
  key_hash text NOT NULL,
  payload_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  CONSTRAINT booking_intake_idempotency_hashes_check CHECK (
    char_length(key_hash) = 64
    AND char_length(payload_hash) = 64
    AND key_hash ~ '^[0-9a-f]+$'
    AND payload_hash ~ '^[0-9a-f]+$'
  ),
  CONSTRAINT booking_intake_idempotency_window_check CHECK (
    expires_at > created_at
    AND expires_at <= created_at + interval '48 hours'
  ),
  CONSTRAINT booking_intake_idempotency_venue_key UNIQUE (venue_id, key_hash)
);

COMMENT ON TABLE public.booking_intake_idempotency IS
  'Bounded intake keys. Stores hashes only, never customer payloads. No hosted cleanup job is claimed (OQ-22).';

CREATE TABLE public.booking_intake_windows (
  venue_id uuid NOT NULL REFERENCES public.venues (id) ON DELETE RESTRICT,
  window_start timestamptz NOT NULL,
  submission_count integer NOT NULL,
  CONSTRAINT booking_intake_windows_pkey PRIMARY KEY (venue_id, window_start),
  CONSTRAINT booking_intake_windows_count_check CHECK (
    submission_count >= 0 AND submission_count <= 100
  )
);

COMMENT ON TABLE public.booking_intake_windows IS
  'Atomic per-venue hourly intake counters. Database-backed; not an in-memory limit.';

CREATE FUNCTION app_private.may_read_booking_queue(p_venue_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    app_private.is_user_active()
    AND app_private.booking_module_entitled(p_venue_id)
    AND (
      app_private.has_tenant_action_on_venue('view_bookings', p_venue_id)
      OR app_private.platform_may_read_tenant(
        (SELECT v.business_id FROM public.venues v WHERE v.id = p_venue_id),
        p_venue_id
      )
    );
$$;

CREATE FUNCTION app_private.may_read_booking_customer(p_venue_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    app_private.may_read_booking_queue(p_venue_id)
    AND (
      app_private.has_tenant_action_on_venue(
        'view_booking_customer_details',
        p_venue_id
      )
      OR app_private.platform_may_read_tenant(
        (SELECT v.business_id FROM public.venues v WHERE v.id = p_venue_id),
        p_venue_id
      )
    );
$$;

CREATE FUNCTION app_private.may_manage_bookings(p_venue_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    app_private.is_user_active()
    AND app_private.subscription_allows_tenant_writes(p_venue_id)
    AND app_private.booking_module_entitled(p_venue_id)
    AND (
      app_private.has_tenant_action_on_venue('manage_bookings', p_venue_id)
      OR app_private.platform_may_write_tenant(
        (SELECT v.business_id FROM public.venues v WHERE v.id = p_venue_id),
        p_venue_id
      )
    );
$$;

CREATE FUNCTION app_private.may_configure_booking_module(p_venue_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    app_private.is_user_active()
    AND app_private.subscription_allows_tenant_writes(p_venue_id)
    AND app_private.booking_module_entitled(p_venue_id)
    AND (
      app_private.has_tenant_action_on_venue(
        'manage_venue_module_visibility',
        p_venue_id
      )
      OR app_private.platform_may_write_tenant(
        (SELECT v.business_id FROM public.venues v WHERE v.id = p_venue_id),
        p_venue_id
      )
    );
$$;

CREATE FUNCTION app_private.append_booking_event(
  p_request_id uuid,
  p_venue_id uuid,
  p_action text,
  p_from_state text,
  p_to_state text,
  p_outcome text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.booking_request_events (
    booking_request_id,
    venue_id,
    action,
    from_state,
    to_state,
    closure_outcome,
    actor_user_id
  )
  VALUES (
    p_request_id,
    p_venue_id,
    p_action,
    p_from_state,
    p_to_state,
    p_outcome,
    app_private.current_user_id()
  );
END;
$$;

CREATE FUNCTION app_private.write_booking_audit(
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
    CASE
      WHEN app_private.is_platform_admin() THEN 'platform_admin'
      WHEN app_private.is_platform_support() THEN 'platform_support'
      ELSE NULL
    END,
    p_action,
    'venue',
    p_business_id,
    p_venue_id,
    'booking_requests',
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

REVOKE ALL ON public.booking_requests FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.booking_request_contacts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.booking_request_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.booking_intake_idempotency FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.booking_intake_windows FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.booking_requests TO authenticated;
GRANT SELECT ON public.booking_request_contacts TO authenticated;
GRANT SELECT ON public.booking_request_events TO authenticated;

ALTER TABLE public.booking_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE public.booking_request_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_request_contacts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.booking_request_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_request_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.booking_intake_idempotency ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_intake_idempotency FORCE ROW LEVEL SECURITY;
ALTER TABLE public.booking_intake_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_intake_windows FORCE ROW LEVEL SECURITY;

CREATE POLICY booking_requests_select_queue ON public.booking_requests
  FOR SELECT TO authenticated
  USING (app_private.may_read_booking_queue(venue_id));

CREATE POLICY booking_request_contacts_select_private
  ON public.booking_request_contacts
  FOR SELECT TO authenticated
  USING (app_private.may_read_booking_customer(venue_id));

CREATE POLICY booking_request_events_select_member
  ON public.booking_request_events
  FOR SELECT TO authenticated
  USING (app_private.may_read_booking_queue(venue_id));

REVOKE ALL ON FUNCTION app_private.booking_settings_shape_ok(jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.protect_booking_settings()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.booking_module_entitled(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.booking_public_intake_open(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.protect_booking_request_keys()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.protect_booking_contact_keys()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.reject_booking_history_mutation()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.may_read_booking_queue(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.may_read_booking_customer(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.may_manage_bookings(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.may_configure_booking_module(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.append_booking_event(
  uuid, uuid, text, text, text, text
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.write_booking_audit(
  text, uuid, uuid, uuid, text, jsonb, jsonb
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION app_private.may_read_booking_queue(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.may_read_booking_customer(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.may_manage_bookings(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.may_configure_booking_module(uuid)
  TO authenticated;
