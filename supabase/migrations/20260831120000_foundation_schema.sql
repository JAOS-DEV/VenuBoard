-- VenuBoard foundation schema.
-- Identity, tenants, memberships, invitations, commercial reference data,
-- entitlements, audit, moderation, and the first translation table.
-- Authorisation helpers and RLS policies are in the following migration.
--
-- Assumptions (security):
-- * public.users.id is the only identity used for authorisation. JWT
--   user_metadata is never read for grants (ADR-007).
-- * No PostgreSQL enum types (ADR-031).
-- * Duplicated tenant keys on children are protected by composite FKs
--   (ADR-037) except venue_translations, whose parent key *is* venue_id;
--   a composite (parent_id, venue_id) is not representable as two columns.
-- * app_private is deliberately omitted from the Data API schemas.

CREATE SCHEMA IF NOT EXISTS app_private;

REVOKE ALL ON SCHEMA app_private FROM PUBLIC;
REVOKE ALL ON SCHEMA public FROM PUBLIC;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Shared trigger helpers
-- ---------------------------------------------------------------------------

CREATE FUNCTION app_private.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := pg_catalog.now();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION app_private.set_updated_at() IS
  'Keeps updated_at in timestamptz UTC. Not a grant; trigger-only.';

-- ---------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------

CREATE TABLE public.users (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email text NOT NULL,
  display_name text NOT NULL,
  preferred_locale text NOT NULL DEFAULT 'en',
  avatar_url text,
  account_status text NOT NULL DEFAULT 'pending',
  mfa_enrolled_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deactivated_at timestamptz,
  CONSTRAINT users_email_key UNIQUE (email),
  CONSTRAINT users_preferred_locale_check CHECK (preferred_locale IN ('en', 'th')),
  CONSTRAINT users_account_status_check CHECK (
    account_status IN ('pending', 'active', 'suspended', 'deactivated')
  ),
  CONSTRAINT users_deactivated_consistency_check CHECK (
    (account_status = 'deactivated' AND deactivated_at IS NOT NULL)
    OR (account_status <> 'deactivated' AND deactivated_at IS NULL)
  )
);

COMMENT ON TABLE public.users IS
  'Application profile. id matches auth.users.id. Account status, not JWT metadata, gates grants.';

CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION app_private.set_updated_at();

CREATE FUNCTION app_private.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.users (id, email, display_name, preferred_locale, account_status)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, NEW.id::text || '@users.invalid'),
    COALESCE(
      NEW.raw_user_meta_data ->> 'display_name',
      pg_catalog.split_part(COALESCE(NEW.email, NEW.id::text), '@', 1)
    ),
    'en',
    'pending'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION app_private.handle_new_auth_user();

CREATE FUNCTION app_private.protect_user_account_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF CURRENT_USER IN ('anon', 'authenticated')
     AND NOT app_private.is_platform_admin() THEN
    IF NEW.account_status IS DISTINCT FROM OLD.account_status
       OR NEW.deactivated_at IS DISTINCT FROM OLD.deactivated_at
       OR NEW.email IS DISTINCT FROM OLD.email
       OR NEW.mfa_enrolled_at IS DISTINCT FROM OLD.mfa_enrolled_at THEN
      RAISE EXCEPTION 'account status, email and MFA fields are not user-editable'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- protect_user_account_fields references is_platform_admin, defined later.
-- The trigger is attached in the authorisation migration.

CREATE TABLE public.platform_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
  role text NOT NULL,
  granted_by uuid REFERENCES public.users (id) ON DELETE RESTRICT,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  CONSTRAINT platform_roles_role_check CHECK (role IN ('platform_admin', 'platform_support'))
);

CREATE UNIQUE INDEX platform_roles_one_active_role
  ON public.platform_roles (user_id, role)
  WHERE revoked_at IS NULL;

CREATE INDEX platform_roles_user_id_idx ON public.platform_roles (user_id)
  WHERE revoked_at IS NULL;

COMMENT ON TABLE public.platform_roles IS
  'Separate axis from tenant memberships. Tenant writes cannot produce platform authority.';

-- ---------------------------------------------------------------------------
-- Permission catalogue (migration-managed; not custom roles)
-- ---------------------------------------------------------------------------

CREATE TABLE public.fixed_roles (
  key text PRIMARY KEY,
  axis text NOT NULL,
  sort_order integer NOT NULL,
  CONSTRAINT fixed_roles_axis_check CHECK (axis IN ('platform', 'business', 'venue'))
);

CREATE TABLE public.permission_actions (
  key text PRIMARY KEY,
  default_scope text NOT NULL,
  description text NOT NULL,
  CONSTRAINT permission_actions_default_scope_check CHECK (
    default_scope IN ('platform', 'business', 'venue', 'self')
  )
);

CREATE TABLE public.role_action_grants (
  role_key text NOT NULL REFERENCES public.fixed_roles (key) ON DELETE CASCADE,
  action_key text NOT NULL REFERENCES public.permission_actions (key) ON DELETE CASCADE,
  grant_kind text NOT NULL,
  is_read_only boolean NOT NULL DEFAULT false,
  PRIMARY KEY (role_key, action_key),
  CONSTRAINT role_action_grants_grant_kind_check CHECK (
    grant_kind IN ('allow', 'conditional')
  )
);

COMMENT ON TABLE public.role_action_grants IS
  'MVP matrix cells that are allow or conditional. Absence is deny. Not tenant-writable.';

INSERT INTO public.fixed_roles (key, axis, sort_order) VALUES
  ('platform_admin', 'platform', 1),
  ('platform_support', 'platform', 2),
  ('business_owner', 'business', 3),
  ('venue_manager', 'venue', 4),
  ('content_editor', 'venue', 5),
  ('booking_manager', 'venue', 6),
  ('staff', 'venue', 7);

INSERT INTO public.permission_actions (key, default_scope, description) VALUES
  ('manage_business', 'business', 'Create/edit business details, create venues, archive venues'),
  ('manage_venue', 'venue', 'Edit venue profile: details, address, navigation, timezone'),
  ('manage_branding', 'venue', 'Logo, brand colours, approved fonts, background image, theme'),
  ('invite_users', 'venue', 'Send invitations into a business or venue scope'),
  ('assign_roles', 'venue', 'Grant, change or remove memberships and roles'),
  ('view_private_staff_data', 'venue', 'View legal name, email, phone, invitation state, internal notes'),
  ('manage_public_staff_profiles', 'venue', 'Edit public staff display fields and translations'),
  ('toggle_staff_presence', 'venue', 'Set in/not-in for staff at the venue'),
  ('create_content', 'venue', 'Create/edit drafts including translation rows'),
  ('approve_content', 'venue', 'Approve or reject submissions awaiting approval'),
  ('publish_content', 'venue', 'Move content to published, unpublish, archive'),
  ('manage_events', 'venue', 'Full event management including scheduling and copy'),
  ('view_bookings', 'venue', 'See booking requests excluding restricted customer details'),
  ('manage_bookings', 'venue', 'Accept, decline, note, assign, reassign booking requests'),
  ('view_analytics', 'venue', 'View analytics dashboards for the scope'),
  ('export_data', 'venue', 'Export venue or business data'),
  ('manage_venue_module_visibility', 'venue', 'Enable/disable and show/hide entitled modules'),
  ('manage_platform_entitlements', 'platform', 'Grant/revoke plans, add-ons, trials, quotas, overrides'),
  ('view_booking_customer_details', 'venue', 'See a booking request customer contact details'),
  ('manage_atmosphere', 'venue', 'Set atmosphere status, wording and expiry'),
  ('manage_offers', 'venue', 'Manage offers and promotions and their validity'),
  ('manage_own_public_profile', 'self', 'Edit own public display name, avatar, bio'),
  ('toggle_own_presence', 'self', 'Toggle own presence at a venue with membership and consent'),
  ('manage_own_consent', 'self', 'Give or withdraw consent to public display'),
  ('submit_content_for_approval', 'venue', 'Submit a draft into pending_approval'),
  ('manage_venue_domains', 'venue', 'Request/record a custom domain'),
  ('manage_notification_preferences', 'self', 'Own preferences; venue-level defaults where scoped'),
  ('view_audit_log', 'venue', 'Read audit entries within scope'),
  ('manage_platform_tenants', 'platform', 'Create businesses, first owners and venues; set subscription state'),
  ('start_support_session', 'platform', 'Open a read-only support session into a tenant'),
  ('grant_support_write_access', 'platform', 'Confirm time-limited, scoped write access within a session'),
  ('manage_platform_users', 'platform', 'Manage platform administrator and support accounts'),
  ('moderate_content', 'platform', 'Unpublish or quarantine tenant content; never author');

-- Matrix: docs/roles-and-permissions.md section 4. Absence = deny.
INSERT INTO public.role_action_grants (role_key, action_key, grant_kind, is_read_only) VALUES
  -- platform_admin
  ('platform_admin', 'manage_business', 'conditional', false),
  ('platform_admin', 'manage_venue', 'conditional', false),
  ('platform_admin', 'manage_branding', 'conditional', false),
  ('platform_admin', 'invite_users', 'conditional', false),
  ('platform_admin', 'assign_roles', 'conditional', false),
  ('platform_admin', 'view_private_staff_data', 'conditional', false),
  ('platform_admin', 'manage_public_staff_profiles', 'conditional', false),
  ('platform_admin', 'view_bookings', 'conditional', true),
  ('platform_admin', 'view_booking_customer_details', 'conditional', false),
  ('platform_admin', 'view_analytics', 'conditional', false),
  ('platform_admin', 'export_data', 'conditional', false),
  ('platform_admin', 'manage_venue_domains', 'allow', false),
  ('platform_admin', 'manage_platform_entitlements', 'allow', false),
  ('platform_admin', 'manage_platform_tenants', 'allow', false),
  ('platform_admin', 'manage_platform_users', 'allow', false),
  ('platform_admin', 'moderate_content', 'allow', false),
  ('platform_admin', 'start_support_session', 'allow', false),
  ('platform_admin', 'grant_support_write_access', 'allow', false),
  ('platform_admin', 'view_audit_log', 'allow', false),
  ('platform_admin', 'manage_notification_preferences', 'allow', false),
  -- platform_support (no moderate_content)
  ('platform_support', 'view_private_staff_data', 'conditional', true),
  ('platform_support', 'view_bookings', 'conditional', true),
  ('platform_support', 'view_booking_customer_details', 'conditional', true),
  ('platform_support', 'view_analytics', 'conditional', true),
  ('platform_support', 'start_support_session', 'allow', false),
  ('platform_support', 'view_audit_log', 'allow', true),
  -- business_owner
  ('business_owner', 'manage_business', 'allow', false),
  ('business_owner', 'manage_venue', 'allow', false),
  ('business_owner', 'manage_branding', 'allow', false),
  ('business_owner', 'invite_users', 'allow', false),
  ('business_owner', 'assign_roles', 'allow', false),
  ('business_owner', 'view_private_staff_data', 'allow', false),
  ('business_owner', 'manage_public_staff_profiles', 'allow', false),
  ('business_owner', 'toggle_staff_presence', 'allow', false),
  ('business_owner', 'create_content', 'allow', false),
  ('business_owner', 'submit_content_for_approval', 'allow', false),
  ('business_owner', 'approve_content', 'allow', false),
  ('business_owner', 'publish_content', 'allow', false),
  ('business_owner', 'manage_events', 'allow', false),
  ('business_owner', 'manage_offers', 'allow', false),
  ('business_owner', 'manage_atmosphere', 'allow', false),
  ('business_owner', 'view_bookings', 'allow', false),
  ('business_owner', 'view_booking_customer_details', 'allow', false),
  ('business_owner', 'manage_bookings', 'allow', false),
  ('business_owner', 'view_analytics', 'allow', false),
  ('business_owner', 'export_data', 'allow', false),
  ('business_owner', 'manage_venue_module_visibility', 'allow', false),
  ('business_owner', 'manage_venue_domains', 'allow', false),
  ('business_owner', 'view_audit_log', 'conditional', false),
  ('business_owner', 'manage_own_public_profile', 'allow', false),
  ('business_owner', 'toggle_own_presence', 'conditional', false),
  ('business_owner', 'manage_own_consent', 'allow', false),
  ('business_owner', 'manage_notification_preferences', 'allow', false),
  -- venue_manager
  ('venue_manager', 'manage_venue', 'allow', false),
  ('venue_manager', 'manage_branding', 'allow', false),
  ('venue_manager', 'invite_users', 'conditional', false),
  ('venue_manager', 'assign_roles', 'conditional', false),
  ('venue_manager', 'view_private_staff_data', 'allow', false),
  ('venue_manager', 'manage_public_staff_profiles', 'allow', false),
  ('venue_manager', 'toggle_staff_presence', 'allow', false),
  ('venue_manager', 'create_content', 'allow', false),
  ('venue_manager', 'submit_content_for_approval', 'allow', false),
  ('venue_manager', 'approve_content', 'allow', false),
  ('venue_manager', 'publish_content', 'allow', false),
  ('venue_manager', 'manage_events', 'allow', false),
  ('venue_manager', 'manage_offers', 'allow', false),
  ('venue_manager', 'manage_atmosphere', 'allow', false),
  ('venue_manager', 'view_bookings', 'allow', false),
  ('venue_manager', 'view_booking_customer_details', 'allow', false),
  ('venue_manager', 'manage_bookings', 'allow', false),
  ('venue_manager', 'view_analytics', 'conditional', false),
  ('venue_manager', 'export_data', 'conditional', false),
  ('venue_manager', 'manage_venue_module_visibility', 'allow', false),
  ('venue_manager', 'manage_venue_domains', 'conditional', false),
  ('venue_manager', 'view_audit_log', 'conditional', false),
  ('venue_manager', 'manage_own_public_profile', 'allow', false),
  ('venue_manager', 'toggle_own_presence', 'conditional', false),
  ('venue_manager', 'manage_own_consent', 'allow', false),
  ('venue_manager', 'manage_notification_preferences', 'allow', false),
  -- content_editor
  ('content_editor', 'create_content', 'allow', false),
  ('content_editor', 'submit_content_for_approval', 'allow', false),
  ('content_editor', 'publish_content', 'conditional', false),
  ('content_editor', 'manage_events', 'conditional', false),
  ('content_editor', 'manage_offers', 'conditional', false),
  ('content_editor', 'manage_atmosphere', 'conditional', false),
  ('content_editor', 'manage_own_public_profile', 'allow', false),
  ('content_editor', 'toggle_own_presence', 'conditional', false),
  ('content_editor', 'manage_own_consent', 'allow', false),
  ('content_editor', 'manage_notification_preferences', 'allow', false),
  -- booking_manager
  ('booking_manager', 'view_bookings', 'allow', false),
  ('booking_manager', 'view_booking_customer_details', 'allow', false),
  ('booking_manager', 'manage_bookings', 'allow', false),
  ('booking_manager', 'view_analytics', 'conditional', false),
  ('booking_manager', 'export_data', 'conditional', false),
  ('booking_manager', 'manage_own_public_profile', 'allow', false),
  ('booking_manager', 'toggle_own_presence', 'conditional', false),
  ('booking_manager', 'manage_own_consent', 'allow', false),
  ('booking_manager', 'manage_notification_preferences', 'allow', false),
  -- staff
  ('staff', 'toggle_staff_presence', 'conditional', false),
  ('staff', 'create_content', 'conditional', false),
  ('staff', 'submit_content_for_approval', 'allow', false),
  ('staff', 'manage_atmosphere', 'conditional', false),
  ('staff', 'manage_own_public_profile', 'allow', false),
  ('staff', 'toggle_own_presence', 'allow', false),
  ('staff', 'manage_own_consent', 'allow', false),
  ('staff', 'manage_notification_preferences', 'allow', false);

-- ---------------------------------------------------------------------------
-- Commercial reference data
-- ---------------------------------------------------------------------------

CREATE TABLE public.modules (
  key text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  is_core boolean NOT NULL DEFAULT false,
  is_available boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL
);

CREATE TABLE public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  default_storage_quota_bytes bigint NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT plans_key_key UNIQUE (key),
  CONSTRAINT plans_quota_positive_check CHECK (default_storage_quota_bytes > 0)
);

CREATE TRIGGER plans_set_updated_at
  BEFORE UPDATE ON public.plans
  FOR EACH ROW
  EXECUTE FUNCTION app_private.set_updated_at();

CREATE TABLE public.plan_modules (
  plan_id uuid NOT NULL REFERENCES public.plans (id) ON DELETE CASCADE,
  module_key text NOT NULL REFERENCES public.modules (key) ON DELETE RESTRICT,
  PRIMARY KEY (plan_id, module_key)
);

CREATE TABLE public.entitlement_sources (
  key text PRIMARY KEY,
  name text NOT NULL,
  precedence integer NOT NULL,
  CONSTRAINT entitlement_sources_precedence_key UNIQUE (precedence)
);

INSERT INTO public.modules (key, name, description, is_core, is_available, sort_order) VALUES
  ('core_profile', 'Core venue profile', 'Identity, address, contact, branding, navigation, subdomain', true, true, 1),
  ('staff_presence', 'Staff presence', 'Public staff profiles and in-today indicator', false, true, 2),
  ('feed', 'Feed', 'Posts with draft, scheduled, approval and published states', false, true, 3),
  ('events', 'Events', 'Upcoming events in the venue timezone', false, true, 4),
  ('booking_requests', 'Booking requests', 'Customer enquiries, accepted or declined by hand', false, true, 5),
  ('atmosphere', 'Atmosphere', 'Quiet / busy / lively / packed indicator', false, true, 6),
  ('offers', 'Offers', 'Promotions with validity dates and terms', false, true, 7),
  ('social_links', 'Social and contact links', 'Known-safe outbound links and share targets', false, true, 8);

INSERT INTO public.entitlement_sources (key, name, precedence) VALUES
  ('override', 'Per-venue override', 100),
  ('trial', 'Trial', 80),
  ('add_on', 'Add-on', 60),
  ('plan', 'Plan', 40);

INSERT INTO public.plans (id, key, name, description, is_active, default_storage_quota_bytes, notes) VALUES
  (
    '10000000-0000-4000-8000-000000000001',
    'core',
    'Core',
    'Core venue profile only. No price is stored; price points are undecided (OQ-05).',
    true,
    1073741824,
    'Quota bytes are a storage ceiling, not a billed amount.'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    'standard',
    'Standard',
    'All MVP modules. No price is stored; price points are undecided (OQ-05).',
    true,
    5368709120,
    'Quota bytes are a storage ceiling, not a billed amount.'
  );

INSERT INTO public.plan_modules (plan_id, module_key)
SELECT '10000000-0000-4000-8000-000000000001', 'core_profile';

INSERT INTO public.plan_modules (plan_id, module_key)
SELECT '10000000-0000-4000-8000-000000000002', key FROM public.modules;

-- ---------------------------------------------------------------------------
-- Tenants
-- ---------------------------------------------------------------------------

CREATE TABLE public.reserved_venue_slugs (
  slug text PRIMARY KEY
);

INSERT INTO public.reserved_venue_slugs (slug) VALUES
  ('admin'), ('platform'), ('api'), ('v'), ('en'), ('th'), ('www'), ('app'),
  ('static'), ('login'), ('auth'), ('signup'), ('support'), ('billing'),
  ('docs'), ('help'), ('status'), ('health'), ('mail'), ('supabase'),
  ('studio'), ('assets'), ('public'), ('private'), ('null'), ('undefined'),
  ('venue'), ('venues'), ('business'), ('businesses'), ('user'), ('users'),
  ('account'), ('settings'), ('dashboard'), ('test'), ('staging'),
  ('production'), ('local'), ('root'), ('system'), ('operator'),
  ('moderate'), ('moderation'), ('cdn'), ('static-assets');

CREATE TABLE public.businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  legal_name text NOT NULL,
  slug text NOT NULL,
  country text NOT NULL,
  default_locale text NOT NULL DEFAULT 'en',
  contact_email text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deactivated_at timestamptz,
  CONSTRAINT businesses_slug_key UNIQUE (slug),
  CONSTRAINT businesses_id_business_id_key UNIQUE (id),
  CONSTRAINT businesses_default_locale_check CHECK (default_locale IN ('en', 'th')),
  CONSTRAINT businesses_status_check CHECK (
    status IN ('active', 'suspended', 'cancelled', 'scheduled_for_deletion', 'deleted')
  )
);

COMMENT ON TABLE public.businesses IS
  'Customer entity. Billing state lives on each venue subscription, not here.';

CREATE TRIGGER businesses_set_updated_at
  BEFORE UPDATE ON public.businesses
  FOR EACH ROW
  EXECUTE FUNCTION app_private.set_updated_at();

CREATE TABLE public.venues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses (id) ON DELETE RESTRICT,
  name text NOT NULL,
  slug text NOT NULL,
  timezone text NOT NULL,
  default_locale text NOT NULL DEFAULT 'en',
  address_line1 text,
  address_line2 text,
  city text,
  province text,
  postal_code text,
  country text,
  latitude numeric,
  longitude numeric,
  directions_url text,
  content_classification text NOT NULL DEFAULT 'general',
  classification_locked_by_platform boolean NOT NULL DEFAULT false,
  publication_state text NOT NULL DEFAULT 'draft',
  status text NOT NULL DEFAULT 'active',
  platform_quarantined_at timestamptz,
  platform_quarantine_reason text,
  platform_quarantined_by uuid REFERENCES public.users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  CONSTRAINT venues_slug_key UNIQUE (slug),
  CONSTRAINT venues_id_venue_id_key UNIQUE (id),
  CONSTRAINT venues_id_business_id_key UNIQUE (id, business_id),
  CONSTRAINT venues_default_locale_check CHECK (default_locale IN ('en', 'th')),
  CONSTRAINT venues_content_classification_check CHECK (
    content_classification IN ('general', 'nightlife_18_plus')
  ),
  CONSTRAINT venues_publication_state_check CHECK (
    publication_state IN ('draft', 'published', 'unpublished_by_platform')
  ),
  CONSTRAINT venues_status_check CHECK (status IN ('active', 'archived')),
  CONSTRAINT venues_status_archived_at_check CHECK (
    (status = 'active' AND archived_at IS NULL)
    OR (status = 'archived' AND archived_at IS NOT NULL)
  ),
  CONSTRAINT venues_quarantine_blocks_publication_check CHECK (
    platform_quarantined_at IS NULL OR publication_state <> 'published'
  ),
  CONSTRAINT venues_quarantine_reason_required_check CHECK (
    (
      platform_quarantined_at IS NULL
      AND platform_quarantine_reason IS NULL
      AND platform_quarantined_by IS NULL
    )
    OR (
      platform_quarantined_at IS NOT NULL
      AND platform_quarantine_reason IS NOT NULL
      AND length(trim(platform_quarantine_reason)) > 0
      AND platform_quarantined_by IS NOT NULL
    )
  )
);

COMMENT ON COLUMN public.venues.id IS
  'Tenant key for this venue. Child tables reference it as venue_id.';

CREATE INDEX venues_business_id_idx ON public.venues (business_id);
CREATE INDEX venues_public_lookup_idx
  ON public.venues (slug)
  WHERE publication_state = 'published'
    AND platform_quarantined_at IS NULL
    AND archived_at IS NULL
    AND status = 'active';

CREATE TRIGGER venues_set_updated_at
  BEFORE UPDATE ON public.venues
  FOR EACH ROW
  EXECUTE FUNCTION app_private.set_updated_at();

CREATE FUNCTION app_private.reject_reserved_venue_slug()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.reserved_venue_slugs r WHERE r.slug = NEW.slug
  ) THEN
    RAISE EXCEPTION 'venue slug "%" is reserved', NEW.slug
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER venues_reject_reserved_slug
  BEFORE INSERT OR UPDATE OF slug ON public.venues
  FOR EACH ROW
  EXECUTE FUNCTION app_private.reject_reserved_venue_slug();

CREATE FUNCTION app_private.protect_venue_platform_columns()
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
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Translations (venue_translations: parent key is venue_id)
-- ---------------------------------------------------------------------------

CREATE TABLE public.venue_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES public.venues (id) ON DELETE CASCADE,
  locale text NOT NULL,
  description text,
  tagline text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.users (id) ON DELETE RESTRICT,
  CONSTRAINT venue_translations_locale_check CHECK (locale IN ('en', 'th')),
  CONSTRAINT venue_translations_parent_locale_key UNIQUE (venue_id, locale)
);

COMMENT ON TABLE public.venue_translations IS
  'Entity-specific translations for venues. Parent id and tenant key are the same column (venue_id), so a composite (parent_id, venue_id) FK is not feasible; mismatch is structurally impossible. UNIQUE (venue_id, locale) still applies.';

CREATE INDEX venue_translations_venue_locale_idx
  ON public.venue_translations (venue_id, locale);

CREATE TRIGGER venue_translations_set_updated_at
  BEFORE UPDATE ON public.venue_translations
  FOR EACH ROW
  EXECUTE FUNCTION app_private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Memberships and invitations
-- ---------------------------------------------------------------------------

CREATE TABLE public.business_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
  role text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  invited_by uuid REFERENCES public.users (id) ON DELETE RESTRICT,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deactivated_at timestamptz,
  CONSTRAINT business_memberships_role_check CHECK (role = 'business_owner'),
  CONSTRAINT business_memberships_status_check CHECK (
    status IN ('pending', 'active', 'suspended', 'deactivated')
  ),
  CONSTRAINT business_memberships_id_business_id_key UNIQUE (id, business_id)
);

CREATE UNIQUE INDEX business_memberships_one_active_person
  ON public.business_memberships (business_id, user_id)
  WHERE deactivated_at IS NULL;

CREATE INDEX business_memberships_user_business_idx
  ON public.business_memberships (user_id, business_id)
  WHERE deactivated_at IS NULL AND status = 'active';

CREATE INDEX business_memberships_business_user_idx
  ON public.business_memberships (business_id, user_id)
  WHERE deactivated_at IS NULL AND status = 'active';

CREATE TRIGGER business_memberships_set_updated_at
  BEFORE UPDATE ON public.business_memberships
  FOR EACH ROW
  EXECUTE FUNCTION app_private.set_updated_at();

CREATE FUNCTION app_private.prevent_removing_last_business_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  remaining integer;
BEGIN
  IF TG_OP = 'DELETE'
     OR (TG_OP = 'UPDATE'
         AND NEW.deactivated_at IS NOT NULL
         AND OLD.deactivated_at IS NULL) THEN
    SELECT count(*)::integer
      INTO remaining
    FROM public.business_memberships m
    WHERE m.business_id = OLD.business_id
      AND m.id IS DISTINCT FROM OLD.id
      AND m.deactivated_at IS NULL
      AND m.status = 'active'
      AND m.role = 'business_owner';

    IF remaining = 0 THEN
      RAISE EXCEPTION 'cannot remove the last active business owner'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER business_memberships_keep_last_owner
  BEFORE UPDATE OR DELETE ON public.business_memberships
  FOR EACH ROW
  EXECUTE FUNCTION app_private.prevent_removing_last_business_owner();

CREATE TABLE public.venue_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES public.venues (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
  role text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  invited_by uuid REFERENCES public.users (id) ON DELETE RESTRICT,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deactivated_at timestamptz,
  CONSTRAINT venue_memberships_role_check CHECK (
    role IN ('venue_manager', 'content_editor', 'booking_manager', 'staff')
  ),
  CONSTRAINT venue_memberships_status_check CHECK (
    status IN ('pending', 'active', 'suspended', 'deactivated')
  ),
  CONSTRAINT venue_memberships_id_venue_id_key UNIQUE (id, venue_id)
);

CREATE UNIQUE INDEX venue_memberships_one_active_person
  ON public.venue_memberships (venue_id, user_id)
  WHERE deactivated_at IS NULL;

CREATE INDEX venue_memberships_user_venue_idx
  ON public.venue_memberships (user_id, venue_id)
  WHERE deactivated_at IS NULL AND status = 'active';

CREATE INDEX venue_memberships_venue_user_idx
  ON public.venue_memberships (venue_id, user_id)
  WHERE deactivated_at IS NULL AND status = 'active';

CREATE TRIGGER venue_memberships_set_updated_at
  BEFORE UPDATE ON public.venue_memberships
  FOR EACH ROW
  EXECUTE FUNCTION app_private.set_updated_at();

CREATE TABLE public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  scope_type text NOT NULL,
  business_id uuid REFERENCES public.businesses (id) ON DELETE CASCADE,
  venue_id uuid REFERENCES public.venues (id) ON DELETE CASCADE,
  role text NOT NULL,
  token_hash text NOT NULL,
  invited_by uuid NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  revoked_at timestamptz,
  state text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invitations_scope_type_check CHECK (scope_type IN ('business', 'venue')),
  CONSTRAINT invitations_state_check CHECK (
    state IN ('pending', 'accepted', 'expired', 'revoked')
  ),
  CONSTRAINT invitations_token_hash_key UNIQUE (token_hash),
  CONSTRAINT invitations_scope_xor_check CHECK (
    (
      scope_type = 'business'
      AND business_id IS NOT NULL
      AND venue_id IS NULL
      AND role = 'business_owner'
    )
    OR (
      scope_type = 'venue'
      AND venue_id IS NOT NULL
      AND business_id IS NULL
      AND role IN ('venue_manager', 'content_editor', 'booking_manager', 'staff')
    )
  )
);

CREATE INDEX invitations_email_state_idx ON public.invitations (email, state);
CREATE INDEX invitations_venue_id_idx ON public.invitations (venue_id);
CREATE INDEX invitations_business_id_idx ON public.invitations (business_id);

CREATE TRIGGER invitations_set_updated_at
  BEFORE UPDATE ON public.invitations
  FOR EACH ROW
  EXECUTE FUNCTION app_private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Subscriptions, billing, entitlements, quota, trials
-- ---------------------------------------------------------------------------

CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES public.venues (id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.plans (id) ON DELETE RESTRICT,
  state text NOT NULL,
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  restricted_at timestamptz,
  suspended_at timestamptz,
  cancelled_at timestamptz,
  delete_after timestamptz,
  external_billing_ref text,
  managed_manually boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscriptions_venue_id_key UNIQUE (venue_id),
  CONSTRAINT subscriptions_id_venue_id_key UNIQUE (id, venue_id),
  CONSTRAINT subscriptions_state_check CHECK (
    state IN (
      'trial',
      'active',
      'past_due',
      'restricted',
      'suspended',
      'cancelled',
      'scheduled_for_deletion',
      'deleted'
    )
  )
);

COMMENT ON COLUMN public.subscriptions.delete_after IS
  'Retention deadline. No default duration is defined (OQ-01).';

CREATE TRIGGER subscriptions_set_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION app_private.set_updated_at();

CREATE TABLE public.venue_billing_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL,
  subscription_id uuid NOT NULL,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  description text NOT NULL,
  state text NOT NULL,
  issued_at timestamptz,
  paid_at timestamptz,
  operator_reference text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT venue_billing_records_state_check CHECK (
    state IN ('draft', 'issued', 'paid', 'void')
  ),
  CONSTRAINT venue_billing_records_id_venue_id_key UNIQUE (id, venue_id),
  CONSTRAINT venue_billing_records_subscription_venue_fk
    FOREIGN KEY (subscription_id, venue_id)
    REFERENCES public.subscriptions (id, venue_id)
    ON DELETE CASCADE
);

COMMENT ON TABLE public.venue_billing_records IS
  'Manual billing notes. No amounts or currencies (OQ-05).';

CREATE INDEX venue_billing_records_venue_id_idx
  ON public.venue_billing_records (venue_id);

CREATE TRIGGER venue_billing_records_set_updated_at
  BEFORE UPDATE ON public.venue_billing_records
  FOR EACH ROW
  EXECUTE FUNCTION app_private.set_updated_at();

CREATE TABLE public.venue_module_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES public.venues (id) ON DELETE CASCADE,
  module_key text NOT NULL REFERENCES public.modules (key) ON DELETE RESTRICT,
  source_key text NOT NULL REFERENCES public.entitlement_sources (key) ON DELETE RESTRICT,
  grant_type text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  granted_by uuid NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  CONSTRAINT venue_module_entitlements_grant_type_check CHECK (
    grant_type IN ('allow', 'deny')
  ),
  CONSTRAINT venue_module_entitlements_window_check CHECK (
    ends_at IS NULL OR ends_at > starts_at
  ),
  CONSTRAINT venue_module_entitlements_id_venue_id_key UNIQUE (id, venue_id)
);

CREATE INDEX venue_module_entitlements_lookup_idx
  ON public.venue_module_entitlements (venue_id, module_key, revoked_at);

CREATE FUNCTION app_private.protect_core_profile_entitlement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.module_key = 'core_profile' AND NEW.grant_type = 'deny' THEN
      RAISE EXCEPTION 'core_profile cannot be denied while the venue exists'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.module_key = 'core_profile'
       AND OLD.grant_type = 'allow'
       AND OLD.revoked_at IS NULL
       AND (NEW.grant_type = 'deny' OR NEW.revoked_at IS NOT NULL) THEN
      RAISE EXCEPTION 'core_profile cannot be revoked while the venue exists'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.module_key = 'core_profile' AND OLD.grant_type = 'allow' AND OLD.revoked_at IS NULL THEN
    RAISE EXCEPTION 'core_profile cannot be deleted while the venue exists'
      USING ERRCODE = '23514';
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER venue_module_entitlements_protect_core
  BEFORE INSERT OR UPDATE OR DELETE ON public.venue_module_entitlements
  FOR EACH ROW
  EXECUTE FUNCTION app_private.protect_core_profile_entitlement();

CREATE TABLE public.venue_module_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES public.venues (id) ON DELETE CASCADE,
  module_key text NOT NULL REFERENCES public.modules (key) ON DELETE RESTRICT,
  is_enabled boolean NOT NULL DEFAULT false,
  is_publicly_visible boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid REFERENCES public.users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT venue_module_settings_venue_module_key UNIQUE (venue_id, module_key),
  CONSTRAINT venue_module_settings_id_venue_id_key UNIQUE (id, venue_id)
);

CREATE TRIGGER venue_module_settings_set_updated_at
  BEFORE UPDATE ON public.venue_module_settings
  FOR EACH ROW
  EXECUTE FUNCTION app_private.set_updated_at();

CREATE TABLE public.venue_module_setting_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_module_setting_id uuid NOT NULL,
  venue_id uuid NOT NULL,
  locale text NOT NULL,
  public_heading text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.users (id) ON DELETE RESTRICT,
  CONSTRAINT venue_module_setting_translations_locale_check CHECK (
    locale IN ('en', 'th')
  ),
  CONSTRAINT venue_module_setting_translations_parent_locale_key
    UNIQUE (venue_module_setting_id, locale),
  CONSTRAINT venue_module_setting_translations_parent_venue_fk
    FOREIGN KEY (venue_module_setting_id, venue_id)
    REFERENCES public.venue_module_settings (id, venue_id)
    ON DELETE CASCADE
);

COMMENT ON TABLE public.venue_module_setting_translations IS
  'ADR-037: composite FK (venue_module_setting_id, venue_id) prevents a heading from claiming another venue.';

CREATE INDEX venue_module_setting_translations_venue_locale_idx
  ON public.venue_module_setting_translations (venue_id, locale);

CREATE TRIGGER venue_module_setting_translations_set_updated_at
  BEFORE UPDATE ON public.venue_module_setting_translations
  FOR EACH ROW
  EXECUTE FUNCTION app_private.set_updated_at();

CREATE TABLE public.venue_storage_usage (
  venue_id uuid PRIMARY KEY REFERENCES public.venues (id) ON DELETE CASCADE,
  quota_bytes bigint NOT NULL,
  used_bytes bigint NOT NULL DEFAULT 0,
  warn_threshold_percent integer NOT NULL DEFAULT 80,
  last_recalculated_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT venue_storage_usage_quota_positive_check CHECK (quota_bytes > 0),
  CONSTRAINT venue_storage_usage_used_nonnegative_check CHECK (used_bytes >= 0),
  CONSTRAINT venue_storage_usage_warn_check CHECK (
    warn_threshold_percent > 0 AND warn_threshold_percent <= 100
  )
);

CREATE TRIGGER venue_storage_usage_set_updated_at
  BEFORE UPDATE ON public.venue_storage_usage
  FOR EACH ROW
  EXECUTE FUNCTION app_private.set_updated_at();

CREATE TABLE public.trial_extensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL,
  subscription_id uuid NOT NULL,
  extended_by uuid NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
  previous_trial_ends_at timestamptz NOT NULL,
  new_trial_ends_at timestamptz NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trial_extensions_reason_present_check CHECK (length(trim(reason)) > 0),
  CONSTRAINT trial_extensions_id_venue_id_key UNIQUE (id, venue_id),
  CONSTRAINT trial_extensions_subscription_venue_fk
    FOREIGN KEY (subscription_id, venue_id)
    REFERENCES public.subscriptions (id, venue_id)
    ON DELETE CASCADE
);

-- ---------------------------------------------------------------------------
-- Support sessions (boundary table only — no UI/workflow in this phase)
-- ---------------------------------------------------------------------------

CREATE TABLE public.support_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
  target_business_id uuid REFERENCES public.businesses (id) ON DELETE RESTRICT,
  target_venue_id uuid REFERENCES public.venues (id) ON DELETE RESTRICT,
  reason text NOT NULL,
  ticket_reference text,
  mode text NOT NULL DEFAULT 'read_only',
  write_granted_by uuid REFERENCES public.users (id) ON DELETE RESTRICT,
  write_granted_at timestamptz,
  write_expires_at timestamptz,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  expires_at timestamptz NOT NULL,
  end_reason text,
  CONSTRAINT support_sessions_mode_check CHECK (mode IN ('read_only', 'write')),
  CONSTRAINT support_sessions_reason_present_check CHECK (length(trim(reason)) > 0),
  CONSTRAINT support_sessions_target_check CHECK (
    target_business_id IS NOT NULL OR target_venue_id IS NOT NULL
  )
);

COMMENT ON TABLE public.support_sessions IS
  'Minimal session boundary so audit_log.support_session_id can FK and platform tenant access stays session-gated (C19). No support-session UI in this phase.';

CREATE INDEX support_sessions_operator_open_idx
  ON public.support_sessions (operator_user_id)
  WHERE ended_at IS NULL;

-- ---------------------------------------------------------------------------
-- Audit and moderation
-- ---------------------------------------------------------------------------

CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_user_id uuid REFERENCES public.users (id) ON DELETE RESTRICT,
  actor_platform_role text,
  support_session_id uuid REFERENCES public.support_sessions (id) ON DELETE RESTRICT,
  action text NOT NULL,
  scope_type text NOT NULL,
  business_id uuid REFERENCES public.businesses (id) ON DELETE RESTRICT,
  venue_id uuid REFERENCES public.venues (id) ON DELETE RESTRICT,
  target_table text,
  target_id uuid,
  summary text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  previous_state jsonb,
  resulting_state jsonb,
  outcome text NOT NULL DEFAULT 'success',
  request_id text,
  environment text NOT NULL,
  CONSTRAINT audit_log_scope_type_check CHECK (
    scope_type IN ('platform', 'business', 'venue', 'self')
  ),
  CONSTRAINT audit_log_outcome_check CHECK (outcome IN ('success', 'denied', 'error')),
  CONSTRAINT audit_log_environment_check CHECK (
    environment IN ('local', 'staging', 'production')
  ),
  CONSTRAINT audit_log_actor_platform_role_check CHECK (
    actor_platform_role IS NULL
    OR actor_platform_role IN ('platform_admin', 'platform_support')
  )
);

COMMENT ON TABLE public.audit_log IS
  'Append-only. No UPDATE or DELETE policy for any role. Venue users cannot insert directly.';

CREATE INDEX audit_log_venue_occurred_idx ON public.audit_log (venue_id, occurred_at DESC);
CREATE INDEX audit_log_business_occurred_idx ON public.audit_log (business_id, occurred_at DESC);
CREATE INDEX audit_log_actor_occurred_idx ON public.audit_log (actor_user_id, occurred_at DESC);

CREATE TABLE public.moderation_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  platform_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
  venue_id uuid NOT NULL REFERENCES public.venues (id) ON DELETE RESTRICT,
  target_table text NOT NULL,
  target_id uuid NOT NULL,
  action text NOT NULL,
  previous_state jsonb,
  resulting_state jsonb,
  reason text NOT NULL,
  evidence_note text,
  audit_log_id uuid REFERENCES public.audit_log (id) ON DELETE RESTRICT,
  CONSTRAINT moderation_actions_action_check CHECK (
    action IN ('quarantine', 'unpublish', 'restore')
  ),
  CONSTRAINT moderation_actions_reason_present_check CHECK (length(trim(reason)) > 0)
);

COMMENT ON TABLE public.moderation_actions IS
  'Append-only platform_admin writes. platform_support cannot moderate. Reason is mandatory.';

CREATE INDEX moderation_actions_venue_idx
  ON public.moderation_actions (venue_id, occurred_at DESC);

-- ---------------------------------------------------------------------------
-- Derived business subscription overview
-- ---------------------------------------------------------------------------

CREATE VIEW public.business_subscription_overview
WITH (security_invoker = true) AS
SELECT
  b.id AS business_id,
  count(v.id)::integer AS venue_count,
  count(s.id) FILTER (WHERE s.state = 'trial')::integer AS trial_count,
  count(s.id) FILTER (WHERE s.state = 'active')::integer AS active_count,
  count(s.id) FILTER (WHERE s.state = 'past_due')::integer AS past_due_count,
  count(s.id) FILTER (WHERE s.state = 'restricted')::integer AS restricted_count,
  count(s.id) FILTER (WHERE s.state = 'suspended')::integer AS suspended_count,
  count(s.id) FILTER (WHERE s.state = 'cancelled')::integer AS cancelled_count,
  count(s.id) FILTER (WHERE s.state = 'scheduled_for_deletion')::integer
    AS scheduled_for_deletion_count,
  count(s.id) FILTER (WHERE s.state = 'deleted')::integer AS deleted_count,
  min(s.trial_ends_at) FILTER (WHERE s.state = 'trial') AS earliest_trial_ends_at,
  coalesce(sum(u.used_bytes), 0)::bigint AS used_bytes_total,
  coalesce(sum(u.quota_bytes), 0)::bigint AS quota_bytes_total
FROM public.businesses b
LEFT JOIN public.venues v ON v.business_id = b.id
LEFT JOIN public.subscriptions s ON s.venue_id = v.id
LEFT JOIN public.venue_storage_usage u ON u.venue_id = v.id
GROUP BY b.id;

COMMENT ON VIEW public.business_subscription_overview IS
  'Derived per-business rollup of venue-scoped subscriptions. Holds no state of its own (ADR-030).';
