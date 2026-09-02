-- Deterministic fictional staff-presence seed (ADR-035).
-- example.com identities only. No real staff or customer data.

DO $$
DECLARE
  epoch timestamptz := timestamptz '2026-08-01 00:00:00+00';
  expired_at timestamptz := timestamptz '2026-08-01 00:00:00+00' - interval '2 hours';
  future_expiry timestamptz := timestamptz '2099-08-01 00:00:00+00';

  harbor_owner_id uuid := '00000000-0000-4000-8000-000000000010';
  atlas_owner_id uuid := '00000000-0000-4000-8000-000000000020';
  editor_id uuid := '00000000-0000-4000-8000-000000000022';
  staff_id uuid := '00000000-0000-4000-8000-000000000024';
  deactivated_id uuid := '00000000-0000-4000-8000-000000000026';
  dual_staff_id uuid := '00000000-0000-4000-8000-000000000027';

  harbor_biz uuid := '00000000-0000-4000-8000-000000000100';
  atlas_biz uuid := '00000000-0000-4000-8000-000000000200';

  harbor_venue uuid := '00000000-0000-4000-8000-000000000101';
  night_orchid uuid := '00000000-0000-4000-8000-000000000201';
  restricted_room uuid := '00000000-0000-4000-8000-000000000203';
  trial_garden uuid := '00000000-0000-4000-8000-000000000205';
  trial_partial uuid := '00000000-0000-4000-8000-000000000206';

  sm_mina uuid := '00000000-0000-4000-8000-000000001101';
  sm_jules uuid := '00000000-0000-4000-8000-000000001102';
  sm_atlas_staff uuid := '00000000-0000-4000-8000-000000001103';
  sm_dual uuid := '00000000-0000-4000-8000-000000001104';
  sm_harbor_at_orchid uuid := '00000000-0000-4000-8000-000000001105';
  sm_editor uuid := '00000000-0000-4000-8000-000000001106';
  sm_rin uuid := '00000000-0000-4000-8000-000000001107';
  sm_pat uuid := '00000000-0000-4000-8000-000000001108';
  sm_kim uuid := '00000000-0000-4000-8000-000000001109';
  sm_casey uuid := '00000000-0000-4000-8000-000000001110';
  sm_restricted uuid := '00000000-0000-4000-8000-000000001111';
  sm_partial uuid := '00000000-0000-4000-8000-000000001112';

  pr_mina uuid := '00000000-0000-4000-8000-000000001201';
  pr_jules uuid := '00000000-0000-4000-8000-000000001202';
  pr_atlas_staff uuid := '00000000-0000-4000-8000-000000001203';
  pr_dual_orchid uuid := '00000000-0000-4000-8000-000000001204';
  pr_dual_garden uuid := '00000000-0000-4000-8000-000000001205';
  pr_harbor_orchid uuid := '00000000-0000-4000-8000-000000001206';
  pr_editor uuid := '00000000-0000-4000-8000-000000001207';
  pr_rin uuid := '00000000-0000-4000-8000-000000001208';
  pr_pat uuid := '00000000-0000-4000-8000-000000001209';
  pr_kim uuid := '00000000-0000-4000-8000-000000001210';
  pr_casey uuid := '00000000-0000-4000-8000-000000001211';
  pr_restricted uuid := '00000000-0000-4000-8000-000000001212';
  pr_partial uuid := '00000000-0000-4000-8000-000000001213';
BEGIN
  -- 01_foundation uses a fixed epoch of 2026-08-01. Trial Garden's 30-day
  -- entitlement therefore ends 2026-08-31. Refresh the still-active trial
  -- fixture so staff_presence can be enabled at reset without rewriting the
  -- foundation seed timestamps.
  UPDATE public.venue_module_entitlements
  SET ends_at = pg_catalog.now() + interval '30 days'
  WHERE venue_id = trial_garden
    AND revoked_at IS NULL
    AND grant_type = 'allow';

  INSERT INTO public.venue_branding (
    venue_id, primary_color, secondary_color, accent_color, background_color,
    text_color, theme_key, font_key, updated_by, created_at, updated_at
  ) VALUES
    (harbor_venue, '#1F4E5F', '#F2C14E', '#F2C14E', '#F7F4EF', '#1A1A1A', 'daylight', 'system', harbor_owner_id, epoch, epoch),
    (night_orchid, '#2A1A2F', '#C45C26', '#E8C39E', '#1A1218', '#F7F1EA', 'midnight', 'system', atlas_owner_id, epoch, epoch);

  INSERT INTO public.venue_module_settings (
    id, venue_id, module_key, is_enabled, is_publicly_visible, display_order,
    settings, updated_by, created_at, updated_at
  ) VALUES
    (
      '00000000-0000-4000-8000-000000000906',
      harbor_venue,
      'staff_presence',
      true,
      true,
      3,
      '{"display_mode":"all_published","carousel_order":"display_order","presence_expiry_hours":12,"carousel_auto_advance":false}'::jsonb,
      harbor_owner_id,
      epoch,
      epoch
    ),
    (
      '00000000-0000-4000-8000-000000000907',
      trial_garden,
      'staff_presence',
      true,
      true,
      2,
      '{"display_mode":"all_published","carousel_order":"name","presence_expiry_hours":8,"carousel_auto_advance":true}'::jsonb,
      atlas_owner_id,
      epoch,
      epoch
    ),
    (
      '00000000-0000-4000-8000-000000000908',
      restricted_room,
      'staff_presence',
      true,
      true,
      2,
      '{"display_mode":"all_published","carousel_order":"display_order","presence_expiry_hours":12,"carousel_auto_advance":false}'::jsonb,
      atlas_owner_id,
      epoch,
      epoch
    ),
    (
      '00000000-0000-4000-8000-000000000909',
      trial_partial,
      'staff_presence',
      false,
      false,
      2,
      '{"display_mode":"present_only","carousel_order":"display_order","presence_expiry_hours":12,"carousel_auto_advance":false}'::jsonb,
      atlas_owner_id,
      epoch,
      epoch
    );

  UPDATE public.venue_module_settings
  SET settings = '{"display_mode":"present_only","carousel_order":"display_order","presence_expiry_hours":12,"carousel_auto_advance":true}'::jsonb
  WHERE id = '00000000-0000-4000-8000-000000000904';

  INSERT INTO public.venue_module_setting_translations (
    id, venue_module_setting_id, venue_id, locale, public_heading, created_at, updated_at, updated_by
  ) VALUES
    ('00000000-0000-4000-8000-000000000921', '00000000-0000-4000-8000-000000000906', harbor_venue, 'en', 'Team on the floor', epoch, epoch, harbor_owner_id),
    ('00000000-0000-4000-8000-000000000922', '00000000-0000-4000-8000-000000000906', harbor_venue, 'th', 'ทีมที่อยู่ตอนนี้', epoch, epoch, harbor_owner_id),
    ('00000000-0000-4000-8000-000000000923', '00000000-0000-4000-8000-000000000904', night_orchid, 'en', 'In tonight', epoch, epoch, atlas_owner_id),
    ('00000000-0000-4000-8000-000000000924', '00000000-0000-4000-8000-000000000904', night_orchid, 'th', 'อยู่ตอนนี้', epoch, epoch, atlas_owner_id),
    ('00000000-0000-4000-8000-000000000925', '00000000-0000-4000-8000-000000000907', trial_garden, 'en', 'Garden hosts', epoch, epoch, atlas_owner_id);

  INSERT INTO public.staff_members (
    id, business_id, user_id, internal_display_name, status,
    deactivated_at, deactivated_by, restored_at, restored_by,
    created_at, updated_at, created_by, updated_by
  ) VALUES
    (sm_mina, harbor_biz, NULL, 'Mina Cole (internal)', 'active', NULL, NULL, NULL, NULL, epoch, epoch, harbor_owner_id, harbor_owner_id),
    (sm_jules, harbor_biz, NULL, 'Jules Park (internal)', 'active', NULL, NULL, NULL, NULL, epoch, epoch, harbor_owner_id, harbor_owner_id),
    (sm_atlas_staff, atlas_biz, staff_id, 'Atlas Staff (internal)', 'active', NULL, NULL, NULL, NULL, epoch, epoch, atlas_owner_id, atlas_owner_id),
    (sm_dual, atlas_biz, dual_staff_id, 'Dual Venue Staff (internal)', 'active', NULL, NULL, NULL, NULL, epoch, epoch, atlas_owner_id, atlas_owner_id),
    (sm_harbor_at_orchid, atlas_biz, harbor_owner_id, 'Harbor owner as orchid staff', 'active', NULL, NULL, NULL, NULL, epoch, epoch, atlas_owner_id, atlas_owner_id),
    (sm_editor, atlas_biz, editor_id, 'Atlas Editor (internal)', 'active', NULL, NULL, NULL, NULL, epoch, epoch, atlas_owner_id, atlas_owner_id),
    (sm_rin, atlas_biz, NULL, 'Rin Vale (internal)', 'active', NULL, NULL, NULL, NULL, epoch, epoch, atlas_owner_id, atlas_owner_id),
    (sm_pat, atlas_biz, deactivated_id, 'Pat Reed (internal)', 'deactivated', epoch, atlas_owner_id, NULL, NULL, epoch, epoch, atlas_owner_id, atlas_owner_id),
    (sm_kim, atlas_biz, NULL, 'Kim Hall (internal)', 'active', NULL, NULL, epoch + interval '1 day', atlas_owner_id, epoch, epoch + interval '1 day', atlas_owner_id, atlas_owner_id),
    (sm_casey, atlas_biz, NULL, 'Casey Ng (internal)', 'active', NULL, NULL, NULL, NULL, epoch, epoch, atlas_owner_id, atlas_owner_id),
    (sm_restricted, atlas_biz, NULL, 'Restricted Room Host (internal)', 'active', NULL, NULL, NULL, NULL, epoch, epoch, atlas_owner_id, atlas_owner_id),
    (sm_partial, atlas_biz, NULL, 'Partial Trial Host (internal)', 'active', NULL, NULL, NULL, NULL, epoch, epoch, atlas_owner_id, atlas_owner_id);

  INSERT INTO public.staff_public_profiles (
    id, venue_id, business_id, staff_member_id, public_display_name, public_title,
    avatar_storage_path, display_order, assignment_status, publication_state,
    consent_state, consent_recorded_at, consent_recorded_by,
    created_at, updated_at, created_by, updated_by
  ) VALUES
    (pr_mina, harbor_venue, harbor_biz, sm_mina, 'Mina Cole', 'Host',
     'venues/00000000-0000-4000-8000-000000000101/staff_presence/mina-cole.png',
     1, 'active', 'published', 'granted', epoch, harbor_owner_id, epoch, epoch, harbor_owner_id, harbor_owner_id),
    (pr_jules, harbor_venue, harbor_biz, sm_jules, 'Jules Park', 'Bar lead',
     NULL, 2, 'active', 'draft', 'pending', NULL, NULL, epoch, epoch, harbor_owner_id, harbor_owner_id),
    (pr_atlas_staff, night_orchid, atlas_biz, sm_atlas_staff, 'Nok Siri', 'Floor host',
     NULL, 1, 'active', 'published', 'granted', epoch, atlas_owner_id, epoch, epoch, atlas_owner_id, atlas_owner_id),
    (pr_dual_orchid, night_orchid, atlas_biz, sm_dual, 'Alex Mori', 'Host',
     NULL, 2, 'active', 'published', 'granted', epoch, atlas_owner_id, epoch, epoch, atlas_owner_id, atlas_owner_id),
    (pr_dual_garden, trial_garden, atlas_biz, sm_dual, 'Alex Mori Garden', 'Garden host',
     NULL, 1, 'active', 'published', 'granted', epoch, atlas_owner_id, epoch, epoch, atlas_owner_id, atlas_owner_id),
    (pr_harbor_orchid, night_orchid, atlas_biz, sm_harbor_at_orchid, 'Sam Harbor', 'Guest host',
     NULL, 3, 'active', 'published', 'withdrawn', epoch, harbor_owner_id, epoch, epoch, atlas_owner_id, atlas_owner_id),
    (pr_editor, night_orchid, atlas_biz, sm_editor, 'Eden Wright', 'Editor on floor',
     NULL, 4, 'active', 'published', 'granted', epoch, editor_id, epoch, epoch, atlas_owner_id, atlas_owner_id),
    (pr_rin, night_orchid, atlas_biz, sm_rin, 'Rin Vale', 'Host',
     NULL, 5, 'active', 'draft', 'pending', NULL, NULL, epoch, epoch, atlas_owner_id, atlas_owner_id),
    (pr_pat, night_orchid, atlas_biz, sm_pat, 'Pat Reed', 'Host',
     NULL, 6, 'active', 'published', 'granted', epoch, atlas_owner_id, epoch, epoch, atlas_owner_id, atlas_owner_id),
    (pr_kim, night_orchid, atlas_biz, sm_kim, 'Kim Hall', 'Host',
     NULL, 7, 'active', 'draft', 'pending', NULL, NULL, epoch, epoch + interval '1 day', atlas_owner_id, atlas_owner_id),
    (pr_casey, night_orchid, atlas_biz, sm_casey, 'Casey Ng', 'Host',
     NULL, 8, 'active', 'published', 'granted', epoch, atlas_owner_id, epoch, epoch, atlas_owner_id, atlas_owner_id),
    (pr_restricted, restricted_room, atlas_biz, sm_restricted, 'River Cole', 'Host',
     NULL, 1, 'active', 'published', 'granted', epoch, atlas_owner_id, epoch, epoch, atlas_owner_id, atlas_owner_id),
    (pr_partial, trial_partial, atlas_biz, sm_partial, 'Lina Pratt', 'Host',
     NULL, 1, 'active', 'published', 'granted', epoch, atlas_owner_id, epoch, epoch, atlas_owner_id, atlas_owner_id);

  INSERT INTO public.staff_public_profile_translations (
    id, staff_public_profile_id, venue_id, locale, public_bio, created_at, updated_at, updated_by
  ) VALUES
    ('00000000-0000-4000-8000-000000001301', pr_mina, harbor_venue, 'en', 'Harbour-side host for the evening service.', epoch, epoch, harbor_owner_id),
    ('00000000-0000-4000-8000-000000001302', pr_mina, harbor_venue, 'th', 'โฮสต์ริมท่าเรือสำหรับรอบเย็น', epoch, epoch, harbor_owner_id),
    ('00000000-0000-4000-8000-000000001303', pr_atlas_staff, night_orchid, 'en', 'Floor host at the fictional night room.', epoch, epoch, atlas_owner_id),
    ('00000000-0000-4000-8000-000000001304', pr_atlas_staff, night_orchid, 'th', 'โฮสต์ประจำห้องสมมติยามค่ำ', epoch, epoch, atlas_owner_id),
    ('00000000-0000-4000-8000-000000001305', pr_dual_garden, trial_garden, 'en', 'English-only garden host bio.', epoch, epoch, atlas_owner_id);

  INSERT INTO public.current_staff_presence (
    id, venue_id, staff_public_profile_id, state, changed_at, changed_by, presence_expires_at, source
  ) VALUES
    ('00000000-0000-4000-8000-000000001401', harbor_venue, pr_mina, 'present', epoch, harbor_owner_id, future_expiry, 'manager'),
    ('00000000-0000-4000-8000-000000001402', harbor_venue, pr_jules, 'not_present', epoch, harbor_owner_id, NULL, 'manager'),
    ('00000000-0000-4000-8000-000000001403', night_orchid, pr_atlas_staff, 'present', epoch, atlas_owner_id, future_expiry, 'manager'),
    ('00000000-0000-4000-8000-000000001404', night_orchid, pr_dual_orchid, 'not_present', epoch, atlas_owner_id, NULL, 'manager'),
    ('00000000-0000-4000-8000-000000001405', trial_garden, pr_dual_garden, 'present', epoch, atlas_owner_id, future_expiry, 'self'),
    ('00000000-0000-4000-8000-000000001406', night_orchid, pr_harbor_orchid, 'present', epoch, harbor_owner_id, future_expiry, 'self'),
    ('00000000-0000-4000-8000-000000001407', night_orchid, pr_editor, 'not_present', epoch, editor_id, NULL, 'self'),
    ('00000000-0000-4000-8000-000000001408', night_orchid, pr_rin, 'not_present', epoch, atlas_owner_id, NULL, 'manager'),
    ('00000000-0000-4000-8000-000000001409', night_orchid, pr_pat, 'not_present', epoch, atlas_owner_id, NULL, 'manager'),
    ('00000000-0000-4000-8000-000000001410', night_orchid, pr_kim, 'not_present', epoch, atlas_owner_id, NULL, 'manager'),
    ('00000000-0000-4000-8000-000000001411', night_orchid, pr_casey, 'present', epoch - interval '3 hours', atlas_owner_id, expired_at, 'manager'),
    ('00000000-0000-4000-8000-000000001412', restricted_room, pr_restricted, 'present', epoch, atlas_owner_id, future_expiry, 'manager'),
    ('00000000-0000-4000-8000-000000001413', trial_partial, pr_partial, 'present', epoch, atlas_owner_id, future_expiry, 'manager');

  INSERT INTO public.staff_presence_events (
    id, venue_id, staff_public_profile_id, state, changed_at, changed_by, presence_expires_at, source
  ) VALUES
    ('00000000-0000-4000-8000-000000001501', harbor_venue, pr_mina, 'present', epoch, harbor_owner_id, future_expiry, 'manager'),
    ('00000000-0000-4000-8000-000000001502', night_orchid, pr_casey, 'present', epoch - interval '3 hours', atlas_owner_id, expired_at, 'manager'),
    ('00000000-0000-4000-8000-000000001503', night_orchid, pr_pat, 'not_present', epoch, atlas_owner_id, NULL, 'deactivation');

  INSERT INTO public.staff_consent_events (
    id, venue_id, staff_public_profile_id, consent_state, recorded_at, recorded_by, source
  ) VALUES
    ('00000000-0000-4000-8000-000000001601', harbor_venue, pr_mina, 'granted', epoch, harbor_owner_id, 'manager'),
    ('00000000-0000-4000-8000-000000001602', night_orchid, pr_harbor_orchid, 'withdrawn', epoch, harbor_owner_id, 'self'),
    ('00000000-0000-4000-8000-000000001603', night_orchid, pr_kim, 'pending', epoch + interval '1 day', atlas_owner_id, 'restoration');
END;
$$;
