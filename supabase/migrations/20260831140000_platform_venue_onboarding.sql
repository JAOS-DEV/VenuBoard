-- Platform-led business and first-venue onboarding. Forward-only.
-- Does not edit the four existing migrations.

-- ---------------------------------------------------------------------------
-- Branding vocabulary and tenant-keyed branding row
-- ---------------------------------------------------------------------------

CREATE TABLE public.branding_themes (
  key text PRIMARY KEY,
  name text NOT NULL,
  sort_order integer NOT NULL
);

INSERT INTO public.branding_themes (key, name, sort_order) VALUES
  ('system', 'System', 1),
  ('midnight', 'Midnight', 2),
  ('daylight', 'Daylight', 3);

CREATE TABLE public.branding_fonts (
  key text PRIMARY KEY,
  name text NOT NULL,
  sort_order integer NOT NULL
);

INSERT INTO public.branding_fonts (key, name, sort_order) VALUES
  ('system', 'System fonts (OQ-27 fallback)', 1);

ALTER TABLE public.venue_translations
  ADD COLUMN name text;

COMMENT ON COLUMN public.venue_translations.name IS
  'Optional localized venue name. The English operational name also lives on venues.name.';

CREATE TABLE public.venue_branding (
  venue_id uuid PRIMARY KEY REFERENCES public.venues (id) ON DELETE CASCADE,
  primary_color text NOT NULL,
  secondary_color text NOT NULL,
  accent_color text NOT NULL,
  background_color text NOT NULL,
  text_color text NOT NULL,
  theme_key text NOT NULL REFERENCES public.branding_themes (key) ON DELETE RESTRICT,
  font_key text NOT NULL REFERENCES public.branding_fonts (key) ON DELETE RESTRICT,
  logo_media_id uuid,
  background_media_id uuid,
  updated_by uuid REFERENCES public.users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT venue_branding_primary_hex_check CHECK (primary_color ~ '^#[0-9A-F]{6}$'),
  CONSTRAINT venue_branding_secondary_hex_check CHECK (secondary_color ~ '^#[0-9A-F]{6}$'),
  CONSTRAINT venue_branding_accent_hex_check CHECK (accent_color ~ '^#[0-9A-F]{6}$'),
  CONSTRAINT venue_branding_background_hex_check CHECK (background_color ~ '^#[0-9A-F]{6}$'),
  CONSTRAINT venue_branding_text_hex_check CHECK (text_color ~ '^#[0-9A-F]{6}$')
);

COMMENT ON TABLE public.venue_branding IS
  'Controlled palette and theme only. No CSS, JavaScript or HTML. Logo and background media ids are deferred placeholders until storage uploads exist.';

CREATE TRIGGER venue_branding_set_updated_at
  BEFORE UPDATE ON public.venue_branding
  FOR EACH ROW
  EXECUTE FUNCTION app_private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Idempotency ledger (platform operational, not tenant-writable)
-- ---------------------------------------------------------------------------

CREATE TABLE public.platform_onboarding_runs (
  idempotency_key text PRIMARY KEY,
  payload_hash text NOT NULL,
  actor_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
  business_id uuid NOT NULL REFERENCES public.businesses (id) ON DELETE RESTRICT,
  venue_id uuid NOT NULL REFERENCES public.venues (id) ON DELETE RESTRICT,
  invitation_id uuid NOT NULL REFERENCES public.invitations (id) ON DELETE RESTRICT,
  result_summary jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_onboarding_runs_key_format_check CHECK (
    idempotency_key ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ),
  CONSTRAINT platform_onboarding_runs_hash_format_check CHECK (
    payload_hash ~ '^[0-9a-f]{64}$'
  )
);

COMMENT ON TABLE public.platform_onboarding_runs IS
  'Committed onboarding outcomes keyed by client idempotency UUID. result_summary never contains raw invitation tokens.';

CREATE INDEX platform_onboarding_runs_venue_id_idx
  ON public.platform_onboarding_runs (venue_id);

CREATE INDEX platform_onboarding_runs_business_id_idx
  ON public.platform_onboarding_runs (business_id);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE FUNCTION app_private.normalize_slug(p_raw text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  v text;
BEGIN
  IF p_raw IS NULL THEN
    RETURN NULL;
  END IF;

  v := pg_catalog.lower(pg_catalog.btrim(p_raw));
  v := pg_catalog.regexp_replace(v, '[^a-z0-9-]+', '-', 'g');
  v := pg_catalog.regexp_replace(v, '-{2,}', '-', 'g');
  v := pg_catalog.regexp_replace(v, '^-+|-+$', '', 'g');

  IF v = '' OR v !~ '^[a-z0-9]+(-[a-z0-9]+)*$' THEN
    RETURN NULL;
  END IF;

  IF pg_catalog.char_length(v) > 64 THEN
    RETURN NULL;
  END IF;

  RETURN v;
END;
$$;

CREATE FUNCTION app_private.canonical_hex_color(p_raw text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  v text;
BEGIN
  IF p_raw IS NULL THEN
    RETURN NULL;
  END IF;
  v := pg_catalog.upper(pg_catalog.btrim(p_raw));
  IF v !~ '^#[0-9A-F]{6}$' THEN
    RETURN NULL;
  END IF;
  RETURN v;
END;
$$;

CREATE FUNCTION app_private.audit_environment()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN pg_catalog.current_setting('venuboard.environment', true) IN ('local', 'staging', 'production')
      THEN pg_catalog.current_setting('venuboard.environment', true)
    ELSE 'local'
  END;
$$;

CREATE FUNCTION app_private.new_invitation_token()
RETURNS text
LANGUAGE sql
VOLATILE
SET search_path = ''
AS $$
  SELECT pg_catalog.rtrim(
    pg_catalog.translate(
      pg_catalog.encode(extensions.gen_random_bytes(32), 'base64'),
      '+/',
      '-_'
    ),
    '='
  );
$$;

CREATE FUNCTION app_private.payload_hash(p_payload jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(p_payload::text, 'UTF8'),
      'sha256'
    ),
    'hex'
  );
$$;

CREATE FUNCTION app_private.map_content_classification(p_raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE pg_catalog.btrim(p_raw)
    WHEN 'general' THEN 'general'
    WHEN 'nightlife_18_plus' THEN 'nightlife_18_plus'
    WHEN 'adult_nightlife' THEN 'nightlife_18_plus'
    ELSE NULL
  END;
$$;

REVOKE ALL ON FUNCTION app_private.normalize_slug(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.canonical_hex_color(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.audit_environment() FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.new_invitation_token() FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.payload_hash(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.map_content_classification(text) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- Slug availability (boolean only; no tenant names)
-- ---------------------------------------------------------------------------

CREATE FUNCTION public.venue_slug_is_available(p_slug text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_slug text;
BEGIN
  v_slug := app_private.normalize_slug(p_slug);
  IF v_slug IS NULL THEN
    RETURN false;
  END IF;

  IF EXISTS (SELECT 1 FROM public.reserved_venue_slugs r WHERE r.slug = v_slug) THEN
    RETURN false;
  END IF;

  IF EXISTS (SELECT 1 FROM public.venues v WHERE v.slug = v_slug) THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.venue_slug_is_available(text) IS
  'True only when the normalised slug is well-formed, not reserved, and unused. Does not reveal the occupying tenant.';

REVOKE ALL ON FUNCTION public.venue_slug_is_available(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.venue_slug_is_available(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Atomic onboarding
-- ---------------------------------------------------------------------------

CREATE FUNCTION public.onboard_platform_venue(
  p_idempotency_key text,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_hash text;
  v_existing public.platform_onboarding_runs%ROWTYPE;
  v_business_id uuid;
  v_venue_id uuid;
  v_invitation_id uuid;
  v_subscription_id uuid;
  v_token text;
  v_token_hash text;
  v_now timestamptz := pg_catalog.now();
  v_trial_end timestamptz;
  v_trial_days integer;
  v_quota bigint;
  v_plan_id uuid := '10000000-0000-4000-8000-000000000002';
  v_plan_quota bigint;
  v_business_name text;
  v_legal_name text;
  v_business_slug text;
  v_country text;
  v_business_locale text;
  v_contact_email text;
  v_venue_name text;
  v_name_th text;
  v_desc_en text;
  v_desc_th text;
  v_tag_en text;
  v_tag_th text;
  v_slug text;
  v_timezone text;
  v_venue_locale text;
  v_classification text;
  v_owner_email text;
  v_primary text;
  v_secondary text;
  v_accent text;
  v_background text;
  v_text text;
  v_theme text;
  v_font text;
  v_lock_class boolean;
  v_excluded text[];
  v_module text;
  v_override jsonb;
  v_summary jsonb;
  v_locales text[];
  v_locale text;
  v_ind jsonb;
  v_ind_days integer;
  v_grant text;
  v_reason text;
  v_override_end timestamptz;
  v_override_quota bigint;
  v_ext_days integer;
BEGIN
  v_user_id := app_private.current_user_id();
  IF v_user_id IS NULL OR app_private.jwt_role() IS DISTINCT FROM 'authenticated' THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'unauthenticated');
  END IF;

  IF NOT app_private.is_user_active() THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'account_inactive');
  END IF;

  -- Support sessions are never a substitute for platform-admin onboarding.
  IF NOT app_private.is_platform_admin()
     OR NOT app_private.role_grants_action('platform_admin', 'manage_platform_tenants') THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'forbidden');
  END IF;

  IF p_idempotency_key IS NULL
     OR p_idempotency_key !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_payload');
  END IF;

  IF p_payload IS NULL OR pg_catalog.jsonb_typeof(p_payload) <> 'object' THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_payload');
  END IF;

  v_hash := app_private.payload_hash(p_payload);

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('onboard:' || p_idempotency_key, 0)
  );

  SELECT * INTO v_existing
  FROM public.platform_onboarding_runs r
  WHERE r.idempotency_key = p_idempotency_key;

  IF FOUND THEN
    IF v_existing.payload_hash <> v_hash THEN
      RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'idempotency_conflict');
    END IF;
    RETURN v_existing.result_summary || pg_catalog.jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'invitation_token', NULL
    );
  END IF;

  v_business_name := pg_catalog.btrim(p_payload #>> '{business,name}');
  v_legal_name := pg_catalog.btrim(COALESCE(p_payload #>> '{business,legal_name}', v_business_name));
  v_country := pg_catalog.upper(pg_catalog.btrim(COALESCE(p_payload #>> '{business,country}', 'TH')));
  v_business_locale := COALESCE(p_payload #>> '{business,default_locale}', 'en');
  v_contact_email := app_private.normalized_email(p_payload #>> '{owner,email}');
  IF v_contact_email IS NULL THEN
    v_contact_email := app_private.normalized_email(p_payload #>> '{business,contact_email}');
  END IF;
  v_owner_email := v_contact_email;

  v_venue_name := pg_catalog.btrim(p_payload #>> '{venue,name_en}');
  v_name_th := NULLIF(pg_catalog.btrim(p_payload #>> '{venue,name_th}'), '');
  v_desc_en := NULLIF(pg_catalog.btrim(p_payload #>> '{venue,description_en}'), '');
  v_desc_th := NULLIF(pg_catalog.btrim(p_payload #>> '{venue,description_th}'), '');
  v_tag_en := NULLIF(pg_catalog.btrim(p_payload #>> '{venue,tagline_en}'), '');
  v_tag_th := NULLIF(pg_catalog.btrim(p_payload #>> '{venue,tagline_th}'), '');
  v_slug := app_private.normalize_slug(p_payload #>> '{venue,slug}');
  v_timezone := pg_catalog.btrim(COALESCE(p_payload #>> '{venue,timezone}', 'Asia/Bangkok'));
  v_venue_locale := COALESCE(p_payload #>> '{venue,default_locale}', 'en');
  v_classification := app_private.map_content_classification(
    p_payload #>> '{venue,content_classification}'
  );
  v_lock_class := COALESCE((p_payload #>> '{venue,classification_locked_by_platform}')::boolean, false);

  IF v_business_name IS NULL OR pg_catalog.char_length(v_business_name) < 2
     OR pg_catalog.char_length(v_business_name) > 120 THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_payload');
  END IF;

  IF v_venue_name IS NULL OR pg_catalog.char_length(v_venue_name) < 2
     OR pg_catalog.char_length(v_venue_name) > 120 THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'missing_english_name');
  END IF;

  IF v_owner_email IS NULL OR v_contact_email IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_payload');
  END IF;

  IF v_business_locale NOT IN ('en', 'th') OR v_venue_locale NOT IN ('en', 'th') THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_locale');
  END IF;

  IF v_country !~ '^[A-Z]{2}$' THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_payload');
  END IF;

  IF v_classification IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_classification');
  END IF;

  IF v_slug IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_slug');
  END IF;

  IF EXISTS (SELECT 1 FROM public.reserved_venue_slugs r WHERE r.slug = v_slug) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'reserved_slug');
  END IF;

  IF EXISTS (SELECT 1 FROM public.venues v WHERE v.slug = v_slug) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'duplicate_slug');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_timezone_names t WHERE t.name = v_timezone
  ) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_timezone');
  END IF;

  SELECT ARRAY(
    SELECT pg_catalog.jsonb_array_elements_text(COALESCE(p_payload #> '{venue,supported_locales}', '["en"]'::jsonb))
  ) INTO v_locales;

  IF NOT ('en' = ANY (v_locales)) THEN
    v_locales := array_append(v_locales, 'en');
  END IF;

  FOREACH v_locale IN ARRAY v_locales LOOP
    IF v_locale NOT IN ('en', 'th') THEN
      RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_locale');
    END IF;
  END LOOP;

  v_primary := app_private.canonical_hex_color(p_payload #>> '{branding,primary_color}');
  v_secondary := app_private.canonical_hex_color(p_payload #>> '{branding,secondary_color}');
  v_accent := app_private.canonical_hex_color(
    COALESCE(p_payload #>> '{branding,accent_color}', p_payload #>> '{branding,secondary_color}')
  );
  v_background := app_private.canonical_hex_color(p_payload #>> '{branding,background_color}');
  v_text := app_private.canonical_hex_color(p_payload #>> '{branding,text_color}');
  v_theme := COALESCE(p_payload #>> '{branding,theme_key}', 'system');
  v_font := COALESCE(p_payload #>> '{branding,font_key}', 'system');

  IF v_primary IS NULL OR v_secondary IS NULL OR v_accent IS NULL
     OR v_background IS NULL OR v_text IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_color');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.branding_themes t WHERE t.key = v_theme) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_theme');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.branding_fonts f WHERE f.key = v_font) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_font');
  END IF;

  v_trial_days := COALESCE((p_payload #>> '{trial,days}')::integer, 30);
  v_ext_days := COALESCE((p_payload #>> '{trial,extension_days}')::integer, 0);
  IF v_trial_days <> 30 OR v_ext_days < 0 OR v_ext_days > 365 THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_trial');
  END IF;

  v_trial_end := v_now + (v_trial_days + v_ext_days) * interval '1 day';
  IF v_trial_end <= v_now THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_trial');
  END IF;

  SELECT p.default_storage_quota_bytes INTO v_plan_quota
  FROM public.plans p
  WHERE p.id = v_plan_id AND p.is_active;

  IF v_plan_quota IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_payload');
  END IF;

  v_quota := COALESCE((p_payload #>> '{trial,quota_bytes}')::bigint, v_plan_quota);
  IF v_quota IS NULL OR v_quota <= 0 OR v_quota > 1099511627776 THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_quota');
  END IF;

  SELECT ARRAY(
    SELECT pg_catalog.jsonb_array_elements_text(COALESCE(p_payload #> '{trial,excluded_module_keys}', '[]'::jsonb))
  ) INTO v_excluded;

  IF 'core_profile' = ANY (v_excluded) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'core_profile_required');
  END IF;

  FOREACH v_module IN ARRAY v_excluded LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.modules m
      WHERE m.key = v_module AND m.is_available AND NOT m.is_core
    ) THEN
      RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'unknown_module');
    END IF;
  END LOOP;

  FOR v_ind IN
    SELECT pg_catalog.jsonb_array_elements(COALESCE(p_payload #> '{trial,individual_module_trials}', '[]'::jsonb))
  LOOP
    v_module := v_ind ->> 'module_key';
    v_ind_days := COALESCE((v_ind ->> 'days')::integer, 0);
    IF v_module = 'core_profile' THEN
      RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'core_profile_required');
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.modules m
      WHERE m.key = v_module AND m.is_available
    ) THEN
      RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'unknown_module');
    END IF;
    IF v_ind_days < 1 OR v_ind_days > 365 THEN
      RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_trial');
    END IF;
  END LOOP;

  FOR v_override IN
    SELECT pg_catalog.jsonb_array_elements(COALESCE(p_payload #> '{overrides}', '[]'::jsonb))
  LOOP
    v_module := v_override ->> 'module_key';
    v_grant := v_override ->> 'grant_type';
    v_reason := pg_catalog.btrim(v_override ->> 'reason');
    IF v_module = 'core_profile' AND v_grant = 'deny' THEN
      RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'core_profile_required');
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.modules m
      WHERE m.key = v_module AND m.is_available
    ) THEN
      RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'unknown_module');
    END IF;
    IF v_grant NOT IN ('allow', 'deny') OR v_reason IS NULL OR v_reason = '' THEN
      RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_payload');
    END IF;
    IF NULLIF(v_override ->> 'quota_bytes', '') IS NOT NULL THEN
      v_override_quota := (v_override ->> 'quota_bytes')::bigint;
      IF v_override_quota IS NULL OR v_override_quota <= 0 OR v_override_quota > 1099511627776 THEN
        RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_quota');
      END IF;
    END IF;
    IF NULLIF(v_override ->> 'ends_at', '') IS NOT NULL THEN
      v_override_end := (v_override ->> 'ends_at')::timestamptz;
      IF v_override_end IS NULL OR v_override_end <= v_now THEN
        RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_trial');
      END IF;
    END IF;
  END LOOP;

  v_business_slug := app_private.normalize_slug(v_business_name);
  IF v_business_slug IS NULL THEN
    v_business_slug := 'business-' || pg_catalog.substr(pg_catalog.gen_random_uuid()::text, 1, 8);
  END IF;
  IF EXISTS (SELECT 1 FROM public.businesses b WHERE b.slug = v_business_slug)
     OR EXISTS (SELECT 1 FROM public.reserved_venue_slugs r WHERE r.slug = v_business_slug) THEN
    v_business_slug := v_business_slug || '-' || pg_catalog.substr(pg_catalog.gen_random_uuid()::text, 1, 8);
    v_business_slug := app_private.normalize_slug(v_business_slug);
  END IF;

  INSERT INTO public.businesses (
    name, legal_name, slug, country, default_locale, contact_email, status
  )
  VALUES (
    v_business_name, v_legal_name, v_business_slug, v_country, v_business_locale, v_contact_email, 'active'
  )
  RETURNING id INTO v_business_id;

  INSERT INTO public.venues (
    business_id, name, slug, timezone, default_locale,
    content_classification, classification_locked_by_platform,
    publication_state, status, country
  )
  VALUES (
    v_business_id, v_venue_name, v_slug, v_timezone, v_venue_locale,
    v_classification, v_lock_class,
    'draft', 'active', v_country
  )
  RETURNING id INTO v_venue_id;

  INSERT INTO public.venue_translations (venue_id, locale, name, description, tagline, updated_by)
  VALUES (v_venue_id, 'en', v_venue_name, v_desc_en, v_tag_en, v_user_id);

  IF 'th' = ANY (v_locales) OR v_name_th IS NOT NULL OR v_desc_th IS NOT NULL OR v_tag_th IS NOT NULL THEN
    INSERT INTO public.venue_translations (venue_id, locale, name, description, tagline, updated_by)
    VALUES (v_venue_id, 'th', v_name_th, v_desc_th, v_tag_th, v_user_id);
  END IF;

  INSERT INTO public.subscriptions (
    venue_id, plan_id, state, trial_started_at, trial_ends_at,
    current_period_start, current_period_end, managed_manually, notes
  )
  VALUES (
    v_venue_id, v_plan_id, 'trial', v_now, v_trial_end,
    v_now, v_trial_end, true, 'Opened by platform onboarding. No price is stored (OQ-05).'
  )
  RETURNING id INTO v_subscription_id;

  IF v_ext_days > 0 THEN
    INSERT INTO public.trial_extensions (
      venue_id, subscription_id, extended_by,
      previous_trial_ends_at, new_trial_ends_at, reason
    )
    VALUES (
      v_venue_id, v_subscription_id, v_user_id,
      v_now + interval '30 days', v_trial_end,
      'Initial trial extension captured at onboarding'
    );
  END IF;

  INSERT INTO public.venue_billing_records (
    venue_id, subscription_id, period_start, period_end,
    description, state, notes
  )
  VALUES (
    v_venue_id, v_subscription_id, v_now, v_trial_end,
    'Opening trial period',
    'draft',
    'Foundation billing record. No amount or currency (OQ-05).'
  );

  INSERT INTO public.venue_storage_usage (venue_id, quota_bytes, used_bytes)
  VALUES (v_venue_id, v_quota, 0);

  FOR v_module IN
    SELECT m.key FROM public.modules m WHERE m.is_available ORDER BY m.sort_order
  LOOP
    IF v_module = ANY (v_excluded) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.venue_module_entitlements (
      venue_id, module_key, source_key, grant_type, starts_at, ends_at, granted_by, reason
    )
    VALUES (
      v_venue_id, v_module, 'trial', 'allow', v_now, v_trial_end, v_user_id,
      'Standard 30-day all-MVP-module trial'
    );

    INSERT INTO public.venue_module_settings (
      venue_id, module_key, is_enabled, is_publicly_visible, display_order, updated_by
    )
    VALUES (
      v_venue_id, v_module, false, false,
      (SELECT m.sort_order FROM public.modules m WHERE m.key = v_module),
      v_user_id
    );
  END LOOP;

  FOR v_ind IN
    SELECT pg_catalog.jsonb_array_elements(COALESCE(p_payload #> '{trial,individual_module_trials}', '[]'::jsonb))
  LOOP
    v_module := v_ind ->> 'module_key';
    v_ind_days := (v_ind ->> 'days')::integer;
    IF v_module = ANY (v_excluded) THEN
      INSERT INTO public.venue_module_entitlements (
        venue_id, module_key, source_key, grant_type, starts_at, ends_at, granted_by, reason
      )
      VALUES (
        v_venue_id, v_module, 'trial', 'allow', v_now,
        v_now + v_ind_days * interval '1 day',
        v_user_id,
        'Individual module trial'
      );

      INSERT INTO public.venue_module_settings (
        venue_id, module_key, is_enabled, is_publicly_visible, display_order, updated_by
      )
      VALUES (
        v_venue_id, v_module, false, false,
        (SELECT m.sort_order FROM public.modules m WHERE m.key = v_module),
        v_user_id
      )
      ON CONFLICT (venue_id, module_key) DO NOTHING;
    END IF;
  END LOOP;

  FOR v_override IN
    SELECT pg_catalog.jsonb_array_elements(COALESCE(p_payload #> '{overrides}', '[]'::jsonb))
  LOOP
    v_module := v_override ->> 'module_key';
    v_grant := v_override ->> 'grant_type';
    v_reason := pg_catalog.btrim(v_override ->> 'reason');
    v_override_end := NULLIF(v_override ->> 'ends_at', '')::timestamptz;
    v_override_quota := NULLIF(v_override ->> 'quota_bytes', '')::bigint;

    INSERT INTO public.venue_module_entitlements (
      venue_id, module_key, source_key, grant_type, starts_at, ends_at, granted_by, reason
    )
    VALUES (
      v_venue_id, v_module, 'override', v_grant, v_now, v_override_end, v_user_id, v_reason
    );

    IF v_override_quota IS NOT NULL THEN
      UPDATE public.venue_storage_usage
      SET quota_bytes = v_override_quota
      WHERE venue_id = v_venue_id;
      v_quota := v_override_quota;
    END IF;
  END LOOP;

  INSERT INTO public.venue_branding (
    venue_id, primary_color, secondary_color, accent_color,
    background_color, text_color, theme_key, font_key, updated_by
  )
  VALUES (
    v_venue_id, v_primary, v_secondary, v_accent,
    v_background, v_text, v_theme, v_font, v_user_id
  );

  v_token := app_private.new_invitation_token();
  v_token_hash := app_private.invitation_token_hash(v_token);

  INSERT INTO public.invitations (
    email, scope_type, business_id, venue_id, role, token_hash,
    invited_by, expires_at, state
  )
  VALUES (
    v_owner_email, 'business', v_business_id, NULL, 'business_owner', v_token_hash,
    v_user_id, v_now + interval '14 days', 'pending'
  )
  RETURNING id INTO v_invitation_id;

  INSERT INTO public.audit_log (
    actor_user_id, actor_platform_role, action, scope_type,
    business_id, venue_id, target_table, target_id, summary, metadata,
    outcome, environment
  )
  VALUES (
    v_user_id, 'platform_admin', 'onboard_platform_venue', 'platform',
    v_business_id, v_venue_id, 'venues', v_venue_id,
    'Platform administrator created a business, first venue, trial and owner invitation',
    pg_catalog.jsonb_build_object(
      'business_id', v_business_id,
      'venue_id', v_venue_id,
      'invitation_id', v_invitation_id,
      'slug', v_slug,
      'classification', v_classification,
      'excluded_module_keys', pg_catalog.to_jsonb(v_excluded),
      'quota_bytes', v_quota
    ),
    'success',
    app_private.audit_environment()
  );

  v_summary := pg_catalog.jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'business_id', v_business_id,
    'venue_id', v_venue_id,
    'invitation_id', v_invitation_id,
    'subscription_id', v_subscription_id,
    'slug', v_slug,
    'publication_state', 'draft',
    'content_classification', v_classification,
    'trial_ends_at', v_trial_end,
    'quota_bytes', v_quota
  );

  INSERT INTO public.platform_onboarding_runs (
    idempotency_key, payload_hash, actor_user_id,
    business_id, venue_id, invitation_id, result_summary
  )
  VALUES (
    p_idempotency_key, v_hash, v_user_id,
    v_business_id, v_venue_id, v_invitation_id, v_summary
  );

  RETURN v_summary || pg_catalog.jsonb_build_object('invitation_token', v_token);
EXCEPTION
  WHEN unique_violation THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'duplicate_slug');
  WHEN invalid_text_representation OR invalid_datetime_format OR numeric_value_out_of_range THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'invalid_payload');
  WHEN OTHERS THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'code', 'unavailable');
END;
$$;

COMMENT ON FUNCTION public.onboard_platform_venue(text, jsonb) IS
  'Atomic platform-admin onboarding. Same idempotency key and payload returns the committed identifiers without the raw invitation token. A different payload for the same key is rejected. Support sessions cannot authorise this function.';

REVOKE ALL ON FUNCTION public.onboard_platform_venue(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.onboard_platform_venue(text, jsonb) TO authenticated;

-- ---------------------------------------------------------------------------
-- Grants and RLS
-- ---------------------------------------------------------------------------

GRANT SELECT ON public.branding_themes TO anon, authenticated;
GRANT SELECT ON public.branding_fonts TO anon, authenticated;

GRANT SELECT ON public.venue_branding TO anon, authenticated;
GRANT INSERT, UPDATE ON public.venue_branding TO authenticated;

GRANT SELECT ON public.platform_onboarding_runs TO authenticated;

ALTER TABLE public.branding_themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branding_themes FORCE ROW LEVEL SECURITY;
ALTER TABLE public.branding_fonts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branding_fonts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.venue_branding ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_branding FORCE ROW LEVEL SECURITY;
ALTER TABLE public.platform_onboarding_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_onboarding_runs FORCE ROW LEVEL SECURITY;

CREATE POLICY branding_themes_select ON public.branding_themes
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY branding_fonts_select ON public.branding_fonts
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY venue_branding_select_public ON public.venue_branding
  FOR SELECT TO anon, authenticated
  USING (app_private.venue_is_publicly_visible(venue_id));

CREATE POLICY venue_branding_select_member ON public.venue_branding
  FOR SELECT TO authenticated
  USING (
    app_private.is_tenant_of_venue(venue_id)
    OR app_private.has_platform_action('manage_platform_tenants')
    OR app_private.platform_may_read_tenant(app_private.venue_business_id(venue_id), venue_id)
  );

CREATE POLICY venue_branding_insert_manager ON public.venue_branding
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      app_private.has_tenant_action_on_venue('manage_branding', venue_id)
      AND app_private.subscription_allows_tenant_writes(venue_id)
    )
    OR app_private.has_platform_action('manage_platform_tenants')
  );

CREATE POLICY venue_branding_update_manager ON public.venue_branding
  FOR UPDATE TO authenticated
  USING (
    (
      app_private.has_tenant_action_on_venue('manage_branding', venue_id)
      AND app_private.subscription_allows_tenant_writes(venue_id)
    )
    OR app_private.has_platform_action('manage_platform_tenants')
  )
  WITH CHECK (
    (
      app_private.has_tenant_action_on_venue('manage_branding', venue_id)
      AND app_private.subscription_allows_tenant_writes(venue_id)
    )
    OR app_private.has_platform_action('manage_platform_tenants')
  );

CREATE POLICY platform_onboarding_runs_select_admin ON public.platform_onboarding_runs
  FOR SELECT TO authenticated
  USING (app_private.has_platform_action('manage_platform_tenants'));

-- Reserved slugs are public vocabulary, not tenant data. The wizard may load
-- them without a JWT (test-identity UI) while the RPC remains authoritative.
GRANT SELECT ON public.reserved_venue_slugs TO anon;

CREATE POLICY reserved_venue_slugs_select_anon ON public.reserved_venue_slugs
  FOR SELECT TO anon
  USING (true);

REVOKE ALL ON TABLE public.branding_themes FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.branding_themes TO anon, authenticated, service_role;

REVOKE ALL ON TABLE public.branding_fonts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.branding_fonts TO anon, authenticated, service_role;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.platform_onboarding_runs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.platform_onboarding_runs TO authenticated;
GRANT ALL ON TABLE public.platform_onboarding_runs TO service_role;

GRANT ALL ON TABLE public.venue_branding TO service_role;
