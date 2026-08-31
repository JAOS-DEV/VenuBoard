-- Deterministic fictional seed for local/staging resets (ADR-035).
-- Fixed UUIDs. example.com emails only. Auth passwords are random bcrypt
-- hashes of random UUIDs — not committed secrets and not usable logins.
--
-- SQL tests impersonate via request.jwt.claim.sub / request.jwt.claims and
-- SET ROLE anon|authenticated. They do not sign in interactively.

CREATE OR REPLACE FUNCTION pg_temp.seed_auth_user(
  p_id uuid,
  p_email text,
  p_epoch timestamptz
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token,
    is_sso_user,
    is_anonymous
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    p_id,
    'authenticated',
    'authenticated',
    p_email,
    extensions.crypt(extensions.gen_random_uuid()::text, extensions.gen_salt('bf')),
    p_epoch,
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    p_epoch,
    p_epoch,
    p_id::text,
    '',
    '',
    p_id::text,
    false,
    false
  );

  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  )
  VALUES (
    p_id,
    p_id,
    jsonb_build_object('sub', p_id::text, 'email', p_email),
    'email',
    p_id::text,
    p_epoch,
    p_epoch,
    p_epoch
  );
END;
$$;

DO $$
DECLARE
  epoch timestamptz := timestamptz '2026-08-01 00:00:00+00';
  admin_id uuid := '00000000-0000-4000-8000-000000000001';
  support_id uuid := '00000000-0000-4000-8000-000000000002';
  harbor_owner_id uuid := '00000000-0000-4000-8000-000000000010';
  atlas_owner_id uuid := '00000000-0000-4000-8000-000000000020';
  manager_id uuid := '00000000-0000-4000-8000-000000000021';
  editor_id uuid := '00000000-0000-4000-8000-000000000022';
  booking_id uuid := '00000000-0000-4000-8000-000000000023';
  staff_id uuid := '00000000-0000-4000-8000-000000000024';
  deactivated_id uuid := '00000000-0000-4000-8000-000000000026';
  dual_staff_id uuid := '00000000-0000-4000-8000-000000000027';

  harbor_biz uuid := '00000000-0000-4000-8000-000000000100';
  atlas_biz uuid := '00000000-0000-4000-8000-000000000200';

  harbor_venue uuid := '00000000-0000-4000-8000-000000000101';
  night_orchid uuid := '00000000-0000-4000-8000-000000000201';
  draft_room uuid := '00000000-0000-4000-8000-000000000202';
  restricted_room uuid := '00000000-0000-4000-8000-000000000203';
  silent_room uuid := '00000000-0000-4000-8000-000000000204';
  trial_garden uuid := '00000000-0000-4000-8000-000000000205';
  trial_partial uuid := '00000000-0000-4000-8000-000000000206';
  trial_extended uuid := '00000000-0000-4000-8000-000000000207';
  trial_single uuid := '00000000-0000-4000-8000-000000000208';
  trial_expired uuid := '00000000-0000-4000-8000-000000000209';
  quota_warn uuid := '00000000-0000-4000-8000-00000000020a';
  quota_over uuid := '00000000-0000-4000-8000-00000000020b';
  past_due_room uuid := '00000000-0000-4000-8000-00000000020c';
  cancelled_room uuid := '00000000-0000-4000-8000-00000000020d';
  scheduled_room uuid := '00000000-0000-4000-8000-00000000020e';
  deleted_room uuid := '00000000-0000-4000-8000-00000000020f';

  plan_core uuid := '10000000-0000-4000-8000-000000000001';
  plan_standard uuid := '10000000-0000-4000-8000-000000000002';

  session_ro uuid := '00000000-0000-4000-8000-000000000301';
  session_write uuid := '00000000-0000-4000-8000-000000000302';
  session_expired uuid := '00000000-0000-4000-8000-000000000303';
BEGIN
  PERFORM pg_temp.seed_auth_user(admin_id, 'platform.admin@example.com', epoch);
  PERFORM pg_temp.seed_auth_user(support_id, 'platform.support@example.com', epoch);
  PERFORM pg_temp.seed_auth_user(harbor_owner_id, 'harbor.owner@example.com', epoch);
  PERFORM pg_temp.seed_auth_user(atlas_owner_id, 'atlas.owner@example.com', epoch);
  PERFORM pg_temp.seed_auth_user(manager_id, 'atlas.manager@example.com', epoch);
  PERFORM pg_temp.seed_auth_user(editor_id, 'atlas.editor@example.com', epoch);
  PERFORM pg_temp.seed_auth_user(booking_id, 'atlas.bookings@example.com', epoch);
  PERFORM pg_temp.seed_auth_user(staff_id, 'atlas.staff@example.com', epoch);
  PERFORM pg_temp.seed_auth_user(deactivated_id, 'deactivated.user@example.com', epoch);
  PERFORM pg_temp.seed_auth_user(dual_staff_id, 'dual.staff@example.com', epoch);

  UPDATE public.users SET
    display_name = 'Platform Admin',
    account_status = 'active',
    preferred_locale = 'en',
    created_at = epoch,
    updated_at = epoch
  WHERE id = admin_id;

  UPDATE public.users SET
    display_name = 'Platform Support',
    account_status = 'active',
    preferred_locale = 'en',
    created_at = epoch,
    updated_at = epoch
  WHERE id = support_id;

  UPDATE public.users SET
    display_name = 'Harbor Owner',
    account_status = 'active',
    preferred_locale = 'en',
    created_at = epoch,
    updated_at = epoch
  WHERE id = harbor_owner_id;

  UPDATE public.users SET
    display_name = 'Atlas Owner',
    account_status = 'active',
    preferred_locale = 'th',
    created_at = epoch,
    updated_at = epoch
  WHERE id = atlas_owner_id;

  UPDATE public.users SET
    display_name = 'Atlas Manager',
    account_status = 'active',
    created_at = epoch,
    updated_at = epoch
  WHERE id = manager_id;

  UPDATE public.users SET
    display_name = 'Atlas Editor',
    account_status = 'active',
    created_at = epoch,
    updated_at = epoch
  WHERE id = editor_id;

  UPDATE public.users SET
    display_name = 'Atlas Bookings',
    account_status = 'active',
    created_at = epoch,
    updated_at = epoch
  WHERE id = booking_id;

  UPDATE public.users SET
    display_name = 'Atlas Staff',
    account_status = 'active',
    created_at = epoch,
    updated_at = epoch
  WHERE id = staff_id;

  UPDATE public.users SET
    display_name = 'Deactivated User',
    account_status = 'deactivated',
    deactivated_at = epoch,
    created_at = epoch,
    updated_at = epoch
  WHERE id = deactivated_id;

  UPDATE public.users SET
    display_name = 'Dual Venue Staff',
    account_status = 'active',
    created_at = epoch,
    updated_at = epoch
  WHERE id = dual_staff_id;

  INSERT INTO public.platform_roles (id, user_id, role, granted_by, granted_at) VALUES
    ('00000000-0000-4000-8000-000000000401', admin_id, 'platform_admin', admin_id, epoch),
    ('00000000-0000-4000-8000-000000000402', support_id, 'platform_support', admin_id, epoch);

  INSERT INTO public.businesses (
    id, name, legal_name, slug, country, default_locale, contact_email, status,
    created_at, updated_at
  ) VALUES
    (
      harbor_biz,
      'Harbor Light Collective',
      'Harbor Light Collective Ltd',
      'harbor-light-collective',
      'TH',
      'en',
      'harbor.owner@example.com',
      'active',
      epoch,
      epoch
    ),
    (
      atlas_biz,
      'Atlas Hospitality Group',
      'Atlas Hospitality Group Ltd',
      'atlas-hospitality',
      'TH',
      'th',
      'atlas.owner@example.com',
      'active',
      epoch,
      epoch
    );

  INSERT INTO public.venues (
    id, business_id, name, slug, timezone, default_locale,
    address_line1, city, country, content_classification,
    classification_locked_by_platform, publication_state, status,
    created_at, updated_at
  ) VALUES
    (harbor_venue, harbor_biz, 'Harbor Light', 'harbor-light', 'Asia/Bangkok', 'en',
     '1 Example Pier', 'Chonburi', 'TH', 'general', false, 'published', 'active', epoch, epoch),
    (night_orchid, atlas_biz, 'Night Orchid', 'night-orchid', 'Asia/Bangkok', 'th',
     '12 Example Walk', 'Phuket', 'TH', 'nightlife_18_plus', true, 'published', 'active', epoch, epoch),
    (draft_room, atlas_biz, 'Draft Room', 'draft-room', 'Asia/Bangkok', 'en',
     '3 Example Lane', 'Phuket', 'TH', 'general', false, 'draft', 'active', epoch, epoch),
    (restricted_room, atlas_biz, 'Restricted Room', 'restricted-room', 'Asia/Bangkok', 'en',
     '4 Example Lane', 'Phuket', 'TH', 'general', false, 'published', 'active', epoch, epoch),
    (silent_room, atlas_biz, 'Silent Room', 'silent-room', 'Asia/Bangkok', 'en',
     '5 Example Lane', 'Phuket', 'TH', 'general', false, 'published', 'active', epoch, epoch),
    (trial_garden, atlas_biz, 'Trial Garden', 'trial-garden', 'Asia/Bangkok', 'en',
     '6 Example Lane', 'Phuket', 'TH', 'general', false, 'published', 'active', epoch, epoch),
    (trial_partial, atlas_biz, 'Trial Partial', 'trial-partial', 'Asia/Bangkok', 'en',
     '7 Example Lane', 'Phuket', 'TH', 'general', false, 'published', 'active', epoch, epoch),
    (trial_extended, atlas_biz, 'Trial Extended', 'trial-extended', 'Asia/Bangkok', 'en',
     '8 Example Lane', 'Phuket', 'TH', 'general', false, 'published', 'active', epoch, epoch),
    (trial_single, atlas_biz, 'Trial Single', 'trial-single', 'Asia/Bangkok', 'en',
     '9 Example Lane', 'Phuket', 'TH', 'general', false, 'published', 'active', epoch, epoch),
    (trial_expired, atlas_biz, 'Trial Expired', 'trial-expired', 'Asia/Bangkok', 'en',
     '10 Example Lane', 'Phuket', 'TH', 'general', false, 'published', 'active', epoch, epoch),
    (quota_warn, atlas_biz, 'Quota Warn', 'quota-warn', 'Asia/Bangkok', 'en',
     '11 Example Lane', 'Phuket', 'TH', 'general', false, 'published', 'active', epoch, epoch),
    (quota_over, atlas_biz, 'Quota Over', 'quota-over', 'Asia/Bangkok', 'en',
     '13 Example Lane', 'Phuket', 'TH', 'general', false, 'published', 'active', epoch, epoch),
    (past_due_room, atlas_biz, 'Past Due Room', 'past-due-room', 'Asia/Bangkok', 'en',
     '14 Example Lane', 'Phuket', 'TH', 'general', false, 'published', 'active', epoch, epoch),
    (cancelled_room, atlas_biz, 'Cancelled Room', 'cancelled-room', 'Asia/Bangkok', 'en',
     '15 Example Lane', 'Phuket', 'TH', 'general', false, 'draft', 'active', epoch, epoch),
    (scheduled_room, atlas_biz, 'Scheduled Room', 'scheduled-room', 'Asia/Bangkok', 'en',
     '16 Example Lane', 'Phuket', 'TH', 'general', false, 'draft', 'active', epoch, epoch),
    (deleted_room, atlas_biz, 'Deleted Room', 'deleted-room', 'Asia/Bangkok', 'en',
     '17 Example Lane', 'Phuket', 'TH', 'general', false, 'draft', 'active', epoch, epoch);

  UPDATE public.venues
  SET archived_at = epoch, status = 'archived'
  WHERE id = deleted_room;

  INSERT INTO public.venue_translations (
    id, venue_id, locale, description, tagline, created_at, updated_at, updated_by
  ) VALUES
    ('00000000-0000-4000-8000-000000000501', harbor_venue, 'en',
     'A fictional harbour-side room for local development.', 'Light on the water', epoch, epoch, harbor_owner_id),
    ('00000000-0000-4000-8000-000000000502', harbor_venue, 'th',
     'ห้องสมมติริมท่าเรือสำหรับพัฒนาในเครื่องท้องถิ่น', 'แสงบนผิวน้ำ', epoch, epoch, harbor_owner_id),
    ('00000000-0000-4000-8000-000000000503', night_orchid, 'th',
     'ห้องสมมติสำหรับผู้ใหญ่เท่านั้น', 'ดอกกล้วยไม้ยามค่ำ', epoch, epoch, atlas_owner_id),
    ('00000000-0000-4000-8000-000000000504', night_orchid, 'en',
     'Fictional 18+ night room for local development.', 'Orchid after dark', epoch, epoch, atlas_owner_id),
    ('00000000-0000-4000-8000-000000000505', draft_room, 'en',
     'Unpublished fictional draft venue.', 'Not on the public site', epoch, epoch, atlas_owner_id),
    ('00000000-0000-4000-8000-000000000506', trial_garden, 'en',
     'English-only trial venue copy.', 'Trial in bloom', epoch, epoch, atlas_owner_id);

  INSERT INTO public.business_memberships (
    id, business_id, user_id, role, status, invited_by, accepted_at, created_at, updated_at
  ) VALUES
    ('00000000-0000-4000-8000-000000000601', harbor_biz, harbor_owner_id, 'business_owner', 'active', admin_id, epoch, epoch, epoch),
    ('00000000-0000-4000-8000-000000000602', atlas_biz, atlas_owner_id, 'business_owner', 'active', admin_id, epoch, epoch, epoch);

  INSERT INTO public.venue_memberships (
    id, venue_id, user_id, role, status, invited_by, accepted_at, created_at, updated_at
  ) VALUES
    ('00000000-0000-4000-8000-000000000611', night_orchid, manager_id, 'venue_manager', 'active', atlas_owner_id, epoch, epoch, epoch),
    ('00000000-0000-4000-8000-000000000612', draft_room, manager_id, 'venue_manager', 'active', atlas_owner_id, epoch, epoch, epoch),
    ('00000000-0000-4000-8000-000000000613', night_orchid, editor_id, 'content_editor', 'active', atlas_owner_id, epoch, epoch, epoch),
    ('00000000-0000-4000-8000-000000000614', night_orchid, booking_id, 'booking_manager', 'active', atlas_owner_id, epoch, epoch, epoch),
    ('00000000-0000-4000-8000-000000000615', night_orchid, staff_id, 'staff', 'active', atlas_owner_id, epoch, epoch, epoch),
    ('00000000-0000-4000-8000-000000000616', night_orchid, harbor_owner_id, 'staff', 'active', atlas_owner_id, epoch, epoch, epoch),
    ('00000000-0000-4000-8000-000000000617', night_orchid, dual_staff_id, 'staff', 'active', atlas_owner_id, epoch, epoch, epoch),
    ('00000000-0000-4000-8000-000000000618', trial_garden, dual_staff_id, 'staff', 'active', atlas_owner_id, epoch, epoch, epoch),
    ('00000000-0000-4000-8000-000000000619', night_orchid, deactivated_id, 'staff', 'deactivated', atlas_owner_id, epoch, epoch, epoch);

  UPDATE public.venue_memberships
  SET deactivated_at = epoch
  WHERE user_id = deactivated_id;

  INSERT INTO public.invitations (
    id, email, scope_type, venue_id, role, token_hash, invited_by, expires_at, state, created_at, updated_at
  ) VALUES
    (
      '00000000-0000-4000-8000-000000000701',
      'new.editor@example.com',
      'venue',
      night_orchid,
      'content_editor',
      'seed-invitation-hash-not-a-secret',
      atlas_owner_id,
      epoch + interval '14 days',
      'pending',
      epoch,
      epoch
    );

  -- Subscriptions covering every documented state.
  INSERT INTO public.subscriptions (
    id, venue_id, plan_id, state, trial_started_at, trial_ends_at,
    current_period_start, current_period_end, restricted_at, suspended_at,
    cancelled_at, delete_after, managed_manually, created_at, updated_at
  ) VALUES
    ('00000000-0000-4000-8000-000000000801', harbor_venue, plan_standard, 'active', NULL, NULL, epoch, epoch + interval '30 days', NULL, NULL, NULL, NULL, true, epoch, epoch),
    ('00000000-0000-4000-8000-000000000802', night_orchid, plan_standard, 'active', NULL, NULL, epoch, epoch + interval '30 days', NULL, NULL, NULL, NULL, true, epoch, epoch),
    ('00000000-0000-4000-8000-000000000803', draft_room, plan_core, 'active', NULL, NULL, epoch, epoch + interval '30 days', NULL, NULL, NULL, NULL, true, epoch, epoch),
    ('00000000-0000-4000-8000-000000000804', restricted_room, plan_standard, 'restricted', NULL, NULL, epoch, epoch + interval '30 days', epoch, NULL, NULL, NULL, true, epoch, epoch),
    ('00000000-0000-4000-8000-000000000805', silent_room, plan_standard, 'suspended', NULL, NULL, epoch, epoch + interval '30 days', NULL, epoch, NULL, NULL, true, epoch, epoch),
    ('00000000-0000-4000-8000-000000000806', trial_garden, plan_standard, 'trial', epoch, epoch + interval '30 days', epoch, epoch + interval '30 days', NULL, NULL, NULL, NULL, true, epoch, epoch),
    ('00000000-0000-4000-8000-000000000807', trial_partial, plan_standard, 'trial', epoch, epoch + interval '30 days', epoch, epoch + interval '30 days', NULL, NULL, NULL, NULL, true, epoch, epoch),
    ('00000000-0000-4000-8000-000000000808', trial_extended, plan_standard, 'trial', epoch - interval '20 days', epoch + interval '20 days', epoch, epoch + interval '20 days', NULL, NULL, NULL, NULL, true, epoch, epoch),
    ('00000000-0000-4000-8000-000000000809', trial_single, plan_core, 'trial', epoch, epoch + interval '30 days', epoch, epoch + interval '30 days', NULL, NULL, NULL, NULL, true, epoch, epoch),
    ('00000000-0000-4000-8000-00000000080a', trial_expired, plan_standard, 'trial', epoch - interval '45 days', epoch - interval '15 days', epoch - interval '45 days', epoch - interval '15 days', NULL, NULL, NULL, NULL, true, epoch, epoch),
    ('00000000-0000-4000-8000-00000000080b', quota_warn, plan_core, 'active', NULL, NULL, epoch, epoch + interval '30 days', NULL, NULL, NULL, NULL, true, epoch, epoch),
    ('00000000-0000-4000-8000-00000000080c', quota_over, plan_core, 'active', NULL, NULL, epoch, epoch + interval '30 days', NULL, NULL, NULL, NULL, true, epoch, epoch),
    ('00000000-0000-4000-8000-00000000080d', past_due_room, plan_standard, 'past_due', NULL, NULL, epoch, epoch + interval '30 days', NULL, NULL, NULL, NULL, true, epoch, epoch),
    ('00000000-0000-4000-8000-00000000080e', cancelled_room, plan_core, 'cancelled', NULL, NULL, epoch, epoch + interval '30 days', NULL, NULL, epoch, NULL, true, epoch, epoch),
    ('00000000-0000-4000-8000-00000000080f', scheduled_room, plan_core, 'scheduled_for_deletion', NULL, NULL, epoch, epoch + interval '30 days', NULL, NULL, epoch - interval '10 days', epoch + interval '20 days', true, epoch, epoch),
    ('00000000-0000-4000-8000-000000000810', deleted_room, plan_core, 'deleted', NULL, NULL, epoch, epoch + interval '30 days', NULL, NULL, epoch - interval '40 days', epoch - interval '10 days', true, epoch, epoch);

  INSERT INTO public.trial_extensions (
    id, venue_id, subscription_id, extended_by, previous_trial_ends_at, new_trial_ends_at, reason, created_at
  ) VALUES
    (
      '00000000-0000-4000-8000-000000000821',
      trial_extended,
      '00000000-0000-4000-8000-000000000808',
      admin_id,
      epoch,
      epoch + interval '20 days',
      'Fictional operator extension for local tests',
      epoch
    );

  INSERT INTO public.venue_billing_records (
    id, venue_id, subscription_id, period_start, period_end, description, state, issued_at, operator_reference, created_at, updated_at
  ) VALUES
    (
      '00000000-0000-4000-8000-000000000831',
      harbor_venue,
      '00000000-0000-4000-8000-000000000801',
      epoch,
      epoch + interval '30 days',
      'Fictional manual billing note — no amount',
      'issued',
      epoch,
      'SEED-INV-1',
      epoch,
      epoch
    );

  -- Entitlements
  INSERT INTO public.venue_module_entitlements (
    venue_id, module_key, source_key, grant_type, starts_at, ends_at, granted_by, reason, created_at
  )
  SELECT harbor_venue, m.key, 'plan', 'allow', epoch, NULL, admin_id, 'Standard plan', epoch
  FROM public.modules m;

  INSERT INTO public.venue_module_entitlements (
    venue_id, module_key, source_key, grant_type, starts_at, ends_at, granted_by, reason, created_at
  )
  SELECT night_orchid, m.key, 'plan', 'allow', epoch, NULL, admin_id, 'Standard plan', epoch
  FROM public.modules m;

  INSERT INTO public.venue_module_entitlements (
    venue_id, module_key, source_key, grant_type, starts_at, ends_at, granted_by, reason, created_at
  ) VALUES
    (draft_room, 'core_profile', 'plan', 'allow', epoch, NULL, admin_id, 'Core plan', epoch);

  INSERT INTO public.venue_module_entitlements (
    venue_id, module_key, source_key, grant_type, starts_at, ends_at, granted_by, reason, created_at
  )
  SELECT restricted_room, m.key, 'plan', 'allow', epoch, NULL, admin_id, 'Standard plan', epoch
  FROM public.modules m;

  INSERT INTO public.venue_module_entitlements (
    venue_id, module_key, source_key, grant_type, starts_at, ends_at, granted_by, reason, created_at
  )
  SELECT silent_room, m.key, 'plan', 'allow', epoch, NULL, admin_id, 'Standard plan', epoch
  FROM public.modules m;

  INSERT INTO public.venue_module_entitlements (
    venue_id, module_key, source_key, grant_type, starts_at, ends_at, granted_by, reason, created_at
  )
  SELECT trial_garden, m.key, 'trial', 'allow', epoch, epoch + interval '30 days', admin_id, 'Full 30-day trial', epoch
  FROM public.modules m;

  INSERT INTO public.venue_module_entitlements (
    venue_id, module_key, source_key, grant_type, starts_at, ends_at, granted_by, reason, created_at
  )
  SELECT trial_partial, m.key, 'trial', 'allow', epoch, epoch + interval '30 days', admin_id, 'Trial with operator exclusions', epoch
  FROM public.modules m
  WHERE m.key IN ('core_profile', 'staff_presence', 'feed');

  INSERT INTO public.venue_module_entitlements (
    venue_id, module_key, source_key, grant_type, starts_at, ends_at, granted_by, reason, created_at
  )
  SELECT trial_extended, m.key, 'trial', 'allow', epoch - interval '20 days', epoch + interval '20 days', admin_id, 'Extended trial', epoch
  FROM public.modules m;

  INSERT INTO public.venue_module_entitlements (
    venue_id, module_key, source_key, grant_type, starts_at, ends_at, granted_by, reason, created_at
  ) VALUES
    (trial_single, 'core_profile', 'plan', 'allow', epoch, NULL, admin_id, 'Core remains', epoch),
    (trial_single, 'events', 'trial', 'allow', epoch, epoch + interval '30 days', admin_id, 'Single-module trial', epoch);

  INSERT INTO public.venue_module_entitlements (
    venue_id, module_key, source_key, grant_type, starts_at, ends_at, granted_by, reason, created_at
  )
  SELECT trial_expired, m.key, 'trial', 'allow', epoch - interval '45 days', epoch - interval '15 days', admin_id, 'Expired trial window', epoch
  FROM public.modules m;

  INSERT INTO public.venue_module_entitlements (
    venue_id, module_key, source_key, grant_type, starts_at, ends_at, granted_by, reason, created_at
  ) VALUES
    (quota_warn, 'core_profile', 'plan', 'allow', epoch, NULL, admin_id, 'Core plan', epoch),
    (quota_over, 'core_profile', 'plan', 'allow', epoch, NULL, admin_id, 'Core plan', epoch),
    (past_due_room, 'core_profile', 'plan', 'allow', epoch, NULL, admin_id, 'Standard remnant', epoch),
    (cancelled_room, 'core_profile', 'plan', 'allow', epoch, NULL, admin_id, 'Core plan', epoch),
    (scheduled_room, 'core_profile', 'plan', 'allow', epoch, NULL, admin_id, 'Core plan', epoch),
    (deleted_room, 'core_profile', 'plan', 'allow', epoch, NULL, admin_id, 'Core plan', epoch);

  INSERT INTO public.venue_module_entitlements (
    venue_id, module_key, source_key, grant_type, starts_at, ends_at, granted_by, reason, created_at
  )
  SELECT past_due_room, m.key, 'plan', 'allow', epoch, NULL, admin_id, 'Standard plan', epoch
  FROM public.modules m
  WHERE m.key <> 'core_profile';

  -- Deny override example on night-orchid offers
  INSERT INTO public.venue_module_entitlements (
    venue_id, module_key, source_key, grant_type, starts_at, ends_at, granted_by, reason, created_at
  ) VALUES
    (night_orchid, 'offers', 'override', 'deny', epoch, NULL, admin_id, 'Fictional deny override', epoch);

  INSERT INTO public.venue_module_settings (
    id, venue_id, module_key, is_enabled, is_publicly_visible, display_order, updated_by, created_at, updated_at
  ) VALUES
    ('00000000-0000-4000-8000-000000000901', harbor_venue, 'core_profile', true, true, 1, harbor_owner_id, epoch, epoch),
    ('00000000-0000-4000-8000-000000000902', harbor_venue, 'feed', true, true, 2, harbor_owner_id, epoch, epoch),
    ('00000000-0000-4000-8000-000000000903', night_orchid, 'core_profile', true, true, 1, atlas_owner_id, epoch, epoch),
    ('00000000-0000-4000-8000-000000000904', night_orchid, 'staff_presence', true, true, 2, atlas_owner_id, epoch, epoch),
    ('00000000-0000-4000-8000-000000000905', draft_room, 'core_profile', true, false, 1, atlas_owner_id, epoch, epoch);

  INSERT INTO public.venue_module_setting_translations (
    id, venue_module_setting_id, venue_id, locale, public_heading, created_at, updated_at, updated_by
  ) VALUES
    ('00000000-0000-4000-8000-000000000911', '00000000-0000-4000-8000-000000000902', harbor_venue, 'en', 'Latest from the harbour', epoch, epoch, harbor_owner_id),
    ('00000000-0000-4000-8000-000000000912', '00000000-0000-4000-8000-000000000902', harbor_venue, 'th', 'ข่าวจากท่าเรือ', epoch, epoch, harbor_owner_id);

  INSERT INTO public.venue_storage_usage (
    venue_id, quota_bytes, used_bytes, warn_threshold_percent, last_recalculated_at, updated_at
  ) VALUES
    (harbor_venue, 5368709120, 104857600, 80, epoch, epoch),
    (night_orchid, 5368709120, 209715200, 80, epoch, epoch),
    (draft_room, 1073741824, 1024, 80, epoch, epoch),
    (restricted_room, 5368709120, 1024, 80, epoch, epoch),
    (silent_room, 5368709120, 1024, 80, epoch, epoch),
    (trial_garden, 5368709120, 1024, 80, epoch, epoch),
    (trial_partial, 5368709120, 1024, 80, epoch, epoch),
    (trial_extended, 5368709120, 1024, 80, epoch, epoch),
    (trial_single, 1073741824, 1024, 80, epoch, epoch),
    (trial_expired, 5368709120, 1024, 80, epoch, epoch),
    (quota_warn, 1073741824, 966367642, 80, epoch, epoch),
    (quota_over, 1073741824, 1174405120, 80, epoch, epoch),
    (past_due_room, 5368709120, 1024, 80, epoch, epoch),
    (cancelled_room, 1073741824, 1024, 80, epoch, epoch),
    (scheduled_room, 1073741824, 1024, 80, epoch, epoch),
    (deleted_room, 1073741824, 1024, 80, epoch, epoch);

  INSERT INTO public.support_sessions (
    id, operator_user_id, target_business_id, target_venue_id, reason, mode,
    write_granted_by, write_granted_at, write_expires_at, started_at, ended_at, expires_at, end_reason
  ) VALUES
    (session_ro, support_id, atlas_biz, night_orchid, 'Fictional read-only diagnosis', 'read_only',
     NULL, NULL, NULL, epoch, epoch + interval '1 hour', epoch + interval '4 hours', 'completed'),
    (session_write, admin_id, atlas_biz, night_orchid, 'Fictional write support', 'write',
     admin_id, epoch, epoch + interval '2 hours', epoch, epoch + interval '2 hours', epoch + interval '4 hours', 'completed'),
    (session_expired, support_id, harbor_biz, harbor_venue, 'Fictional expired session', 'read_only',
     NULL, NULL, NULL, epoch - interval '2 days', epoch - interval '1 day', epoch - interval '1 day', 'expired');

  INSERT INTO public.audit_log (
    id, occurred_at, actor_user_id, actor_platform_role, support_session_id, action, scope_type,
    business_id, venue_id, target_table, target_id, summary, outcome, environment
  ) VALUES
    (
      '00000000-0000-4000-8000-000000000a01',
      epoch,
      support_id,
      'platform_support',
      session_ro,
      'start_support_session',
      'venue',
      atlas_biz,
      night_orchid,
      'support_sessions',
      session_ro,
      'Opened fictional read-only session',
      'success',
      'local'
    ),
    (
      '00000000-0000-4000-8000-000000000a02',
      epoch,
      atlas_owner_id,
      NULL,
      NULL,
      'manage_venue',
      'venue',
      atlas_biz,
      night_orchid,
      'venues',
      night_orchid,
      'Owner updated fictional venue profile',
      'success',
      'local'
    );
END;
$$;
