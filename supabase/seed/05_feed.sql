-- Deterministic fictional feed seed. Reset-relative timestamps.

DO $$
DECLARE
  v_now timestamptz := pg_catalog.now();
  harbor_owner_id uuid := '00000000-0000-4000-8000-000000000010';
  atlas_owner_id uuid := '00000000-0000-4000-8000-000000000020';
  atlas_manager_id uuid := '00000000-0000-4000-8000-000000000021';
  atlas_editor_id uuid := '00000000-0000-4000-8000-000000000022';
  atlas_staff_id uuid := '00000000-0000-4000-8000-000000000024';
  admin_id uuid := '00000000-0000-4000-8000-000000000001';

  business_harbor uuid := '00000000-0000-4000-8000-000000000100';
  business_atlas uuid := '00000000-0000-4000-8000-000000000200';

  harbor_venue uuid := '00000000-0000-4000-8000-000000000101';
  night_orchid uuid := '00000000-0000-4000-8000-000000000201';
  draft_room uuid := '00000000-0000-4000-8000-000000000202';
  restricted_room uuid := '00000000-0000-4000-8000-000000000203';
  silent_room uuid := '00000000-0000-4000-8000-000000000204';
  trial_garden uuid := '00000000-0000-4000-8000-000000000205';
  trial_partial uuid := '00000000-0000-4000-8000-000000000206';
  trial_expired uuid := '00000000-0000-4000-8000-000000000209';

  s_night uuid := '00000000-0000-5000-8000-000000000a01';
  s_restricted uuid := '00000000-0000-5000-8000-000000000a02';
  s_silent uuid := '00000000-0000-5000-8000-000000000a03';
  s_garden uuid := '00000000-0000-5000-8000-000000000a04';
  s_partial uuid := '00000000-0000-5000-8000-000000000a05';
  s_expired uuid := '00000000-0000-5000-8000-000000000a06';

  p_harbor_pinned_1 uuid := '00000000-0000-4000-8000-000000000501';
  p_harbor_pinned_2 uuid := '00000000-0000-4000-8000-000000000502';
  p_harbor_pinned_3 uuid := '00000000-0000-4000-8000-000000000503';
  p_harbor_ordinary uuid := '00000000-0000-4000-8000-000000000504';
  p_harbor_en_only uuid := '00000000-0000-4000-8000-000000000505';
  p_night_public uuid := '00000000-0000-4000-8000-000000000506';
  p_night_draft uuid := '00000000-0000-4000-8000-000000000507';
  p_night_pending uuid := '00000000-0000-4000-8000-000000000508';
  p_night_approved uuid := '00000000-0000-4000-8000-000000000509';
  p_night_scheduled uuid := '00000000-0000-4000-8000-00000000050a';
  p_night_due uuid := '00000000-0000-4000-8000-00000000050b';
  p_night_archived uuid := '00000000-0000-4000-8000-00000000050c';
  p_night_rejected uuid := '00000000-0000-4000-8000-00000000050d';
  p_night_quarantined uuid := '00000000-0000-4000-8000-00000000050e';
  p_night_copy_source uuid := '00000000-0000-4000-8000-00000000050f';
  p_restricted_public uuid := '00000000-0000-4000-8000-000000000510';
  p_silent_leftover uuid := '00000000-0000-4000-8000-000000000511';
  p_partial_leftover uuid := '00000000-0000-4000-8000-000000000512';
  p_expired_leftover uuid := '00000000-0000-4000-8000-000000000513';
  p_draft_leftover uuid := '00000000-0000-4000-8000-000000000514';
  p_harbor_extra_1 uuid := '00000000-0000-4000-8000-000000000515';
  p_harbor_extra_2 uuid := '00000000-0000-4000-8000-000000000516';
  p_harbor_extra_3 uuid := '00000000-0000-4000-8000-000000000517';
  p_harbor_extra_4 uuid := '00000000-0000-4000-8000-000000000518';
  p_harbor_extra_5 uuid := '00000000-0000-4000-8000-000000000519';
  p_harbor_extra_6 uuid := '00000000-0000-4000-8000-00000000051a';
  p_harbor_extra_7 uuid := '00000000-0000-4000-8000-00000000051b';
  p_harbor_extra_8 uuid := '00000000-0000-4000-8000-00000000051c';
BEGIN
  UPDATE public.venue_module_entitlements
  SET ends_at = pg_catalog.now() + interval '30 days'
  WHERE venue_id = trial_partial
    AND module_key = 'feed'
    AND grant_type = 'allow'
    AND revoked_at IS NULL;

  UPDATE public.venue_module_settings
  SET
    settings = jsonb_build_object(
      'require_manager_approval', false,
      'homepage_preview_enabled', true,
      'homepage_preview_count', 6,
      'horizon_days', 365,
      'display_density', 'comfortable'
    ),
    is_enabled = true,
    is_publicly_visible = true,
    updated_at = v_now
  WHERE venue_id = harbor_venue AND module_key = 'feed';

  INSERT INTO public.venue_module_settings (
    id, venue_id, module_key, is_enabled, is_publicly_visible, display_order,
    settings, updated_by
  ) VALUES
    (
      s_night, night_orchid, 'feed', true, true, 9,
      jsonb_build_object(
        'require_manager_approval', true,
        'homepage_preview_enabled', true,
        'homepage_preview_count', 3,
        'horizon_days', 365,
        'display_density', 'comfortable'
      ),
      atlas_owner_id
    ),
    (
      s_restricted, restricted_room, 'feed', true, true, 9,
      jsonb_build_object(
        'require_manager_approval', false,
        'homepage_preview_enabled', true,
        'homepage_preview_count', 3,
        'horizon_days', 365,
        'display_density', 'compact'
      ),
      atlas_owner_id
    ),
    (
      s_silent, silent_room, 'feed', false, true, 9,
      jsonb_build_object(
        'require_manager_approval', false,
        'homepage_preview_enabled', true,
        'homepage_preview_count', 3,
        'horizon_days', 365,
        'display_density', 'comfortable'
      ),
      atlas_owner_id
    ),
    (
      s_garden, trial_garden, 'feed', true, true, 9,
      jsonb_build_object(
        'require_manager_approval', false,
        'homepage_preview_enabled', true,
        'homepage_preview_count', 3,
        'horizon_days', 365,
        'display_density', 'comfortable'
      ),
      atlas_owner_id
    ),
    (
      s_partial, trial_partial, 'feed', false, true, 9,
      jsonb_build_object(
        'require_manager_approval', false,
        'homepage_preview_enabled', true,
        'homepage_preview_count', 3,
        'horizon_days', 365,
        'display_density', 'comfortable'
      ),
      atlas_owner_id
    ),
    (
      s_expired, trial_expired, 'feed', false, true, 9,
      jsonb_build_object(
        'require_manager_approval', false,
        'homepage_preview_enabled', true,
        'homepage_preview_count', 3,
        'horizon_days', 365,
        'display_density', 'comfortable'
      ),
      atlas_owner_id
    )
  ON CONFLICT (venue_id, module_key) DO UPDATE SET
    is_enabled = EXCLUDED.is_enabled,
    is_publicly_visible = EXCLUDED.is_publicly_visible,
    settings = EXCLUDED.settings,
    updated_by = EXCLUDED.updated_by,
    updated_at = v_now;

  INSERT INTO public.venue_module_setting_translations (
    venue_module_setting_id, venue_id, locale, public_heading, updated_by
  ) VALUES
    (s_night, night_orchid, 'en', 'Night Orchid updates', atlas_owner_id),
    (s_night, night_orchid, 'th', 'ข่าวไนท์ออร์คิด', atlas_owner_id),
    (s_restricted, restricted_room, 'en', 'Restricted updates', atlas_owner_id),
    (s_garden, trial_garden, 'en', 'Garden updates', atlas_owner_id)
  ON CONFLICT (venue_module_setting_id, locale) DO UPDATE SET
    public_heading = EXCLUDED.public_heading;

  INSERT INTO public.feed_posts (
    id, venue_id, business_id, post_type, state, scheduled_for, published_at,
    submitted_by, approved_by, approved_at, rejection_reason, is_pinned, pinned_at,
    archived_at, source_post_id, source_venue_id, platform_quarantined_at,
    platform_quarantine_reason, platform_quarantined_by, created_by, updated_by
  ) VALUES
    (
      p_harbor_pinned_1, harbor_venue, business_harbor, 'announcement', 'published',
      NULL, v_now - interval '3 hours', NULL, NULL, NULL, NULL, true,
      v_now - interval '3 hours', NULL, NULL, NULL, NULL, NULL, NULL,
      harbor_owner_id, harbor_owner_id
    ),
    (
      p_harbor_pinned_2, harbor_venue, business_harbor, 'update', 'published',
      NULL, v_now - interval '5 hours', NULL, NULL, NULL, NULL, true,
      v_now - interval '5 hours', NULL, NULL, NULL, NULL, NULL, NULL,
      harbor_owner_id, harbor_owner_id
    ),
    (
      p_harbor_pinned_3, harbor_venue, business_harbor, 'notice', 'published',
      NULL, v_now - interval '8 hours', NULL, NULL, NULL, NULL, true,
      v_now - interval '8 hours', NULL, NULL, NULL, NULL, NULL, NULL,
      harbor_owner_id, harbor_owner_id
    ),
    (
      p_harbor_ordinary, harbor_venue, business_harbor, 'update', 'published',
      NULL, v_now - interval '1 day', NULL, NULL, NULL, NULL, false, NULL,
      NULL, NULL, NULL, NULL, NULL, NULL, harbor_owner_id, harbor_owner_id
    ),
    (
      p_harbor_en_only, harbor_venue, business_harbor, 'update', 'published',
      NULL, v_now - interval '2 days', NULL, NULL, NULL, NULL, false, NULL,
      NULL, NULL, NULL, NULL, NULL, NULL, harbor_owner_id, harbor_owner_id
    ),
    (
      p_harbor_extra_1, harbor_venue, business_harbor, 'update', 'published',
      NULL, v_now - interval '3 days', NULL, NULL, NULL, NULL, false, NULL,
      NULL, NULL, NULL, NULL, NULL, NULL, harbor_owner_id, harbor_owner_id
    ),
    (
      p_harbor_extra_2, harbor_venue, business_harbor, 'notice', 'published',
      NULL, v_now - interval '4 days', NULL, NULL, NULL, NULL, false, NULL,
      NULL, NULL, NULL, NULL, NULL, NULL, harbor_owner_id, harbor_owner_id
    ),
    (
      p_harbor_extra_3, harbor_venue, business_harbor, 'update', 'published',
      NULL, v_now - interval '5 days', NULL, NULL, NULL, NULL, false, NULL,
      NULL, NULL, NULL, NULL, NULL, NULL, harbor_owner_id, harbor_owner_id
    ),
    (
      p_harbor_extra_4, harbor_venue, business_harbor, 'announcement', 'published',
      NULL, v_now - interval '6 days', NULL, NULL, NULL, NULL, false, NULL,
      NULL, NULL, NULL, NULL, NULL, NULL, harbor_owner_id, harbor_owner_id
    ),
    (
      p_harbor_extra_5, harbor_venue, business_harbor, 'update', 'published',
      NULL, v_now - interval '7 days', NULL, NULL, NULL, NULL, false, NULL,
      NULL, NULL, NULL, NULL, NULL, NULL, harbor_owner_id, harbor_owner_id
    ),
    (
      p_harbor_extra_6, harbor_venue, business_harbor, 'notice', 'published',
      NULL, v_now - interval '8 days', NULL, NULL, NULL, NULL, false, NULL,
      NULL, NULL, NULL, NULL, NULL, NULL, harbor_owner_id, harbor_owner_id
    ),
    (
      p_harbor_extra_7, harbor_venue, business_harbor, 'update', 'published',
      NULL, v_now - interval '9 days', NULL, NULL, NULL, NULL, false, NULL,
      NULL, NULL, NULL, NULL, NULL, NULL, harbor_owner_id, harbor_owner_id
    ),
    (
      p_harbor_extra_8, harbor_venue, business_harbor, 'update', 'published',
      NULL, v_now - interval '10 days', NULL, NULL, NULL, NULL, false, NULL,
      NULL, NULL, NULL, NULL, NULL, NULL, harbor_owner_id, harbor_owner_id
    ),
    (
      p_night_public, night_orchid, business_atlas, 'update', 'published',
      NULL, v_now - interval '4 hours', atlas_editor_id, atlas_manager_id,
      v_now - interval '5 hours', NULL, false, NULL, NULL, NULL, NULL,
      NULL, NULL, NULL, atlas_editor_id, atlas_manager_id
    ),
    (
      p_night_draft, night_orchid, business_atlas, 'update', 'draft',
      NULL, NULL, NULL, NULL, NULL, NULL, false, NULL, NULL, NULL, NULL,
      NULL, NULL, NULL, atlas_editor_id, atlas_editor_id
    ),
    (
      p_night_pending, night_orchid, business_atlas, 'announcement',
      'pending_approval', NULL, NULL, atlas_editor_id, NULL, NULL, NULL,
      false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, atlas_editor_id,
      atlas_editor_id
    ),
    (
      p_night_approved, night_orchid, business_atlas, 'update', 'draft',
      NULL, NULL, atlas_editor_id, atlas_manager_id, v_now - interval '1 hour',
      NULL, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, atlas_editor_id,
      atlas_manager_id
    ),
    (
      p_night_scheduled, night_orchid, business_atlas, 'notice', 'scheduled',
      v_now + interval '2 days', NULL, atlas_editor_id, atlas_manager_id,
      v_now - interval '30 minutes', NULL, false, NULL, NULL, NULL, NULL,
      NULL, NULL, NULL, atlas_manager_id, atlas_manager_id
    ),
    (
      p_night_due, night_orchid, business_atlas, 'update', 'scheduled',
      v_now - interval '10 minutes', v_now - interval '10 minutes',
      atlas_editor_id, atlas_manager_id, v_now - interval '1 day', NULL,
      false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, atlas_manager_id,
      atlas_manager_id
    ),
    (
      p_night_archived, night_orchid, business_atlas, 'update', 'archived',
      NULL, v_now - interval '10 days', atlas_editor_id, atlas_manager_id,
      v_now - interval '11 days', NULL, false, NULL, v_now - interval '2 days',
      NULL, NULL, NULL, NULL, NULL, atlas_manager_id, atlas_manager_id
    ),
    (
      p_night_rejected, night_orchid, business_atlas, 'update', 'draft',
      NULL, NULL, atlas_staff_id, NULL, NULL, 'Needs a clearer public title',
      false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, atlas_staff_id,
      atlas_manager_id
    ),
    (
      p_night_quarantined, night_orchid, business_atlas, 'update', 'draft',
      NULL, NULL, NULL, NULL, NULL, NULL, false, NULL, NULL, NULL, NULL,
      v_now - interval '1 hour', 'seed_quarantine', admin_id, atlas_editor_id,
      atlas_editor_id
    ),
    (
      p_night_copy_source, night_orchid, business_atlas, 'announcement',
      'published', NULL, v_now - interval '6 hours', NULL, atlas_manager_id,
      v_now - interval '7 hours', NULL, false, NULL, NULL, NULL, NULL,
      NULL, NULL, NULL, atlas_owner_id, atlas_owner_id
    ),
    (
      p_restricted_public, restricted_room, business_atlas, 'notice',
      'published', NULL, v_now - interval '2 hours', NULL, NULL, NULL, NULL,
      false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, atlas_owner_id,
      atlas_owner_id
    ),
    (
      p_silent_leftover, silent_room, business_atlas, 'update', 'published',
      NULL, v_now - interval '3 hours', NULL, NULL, NULL, NULL, false, NULL,
      NULL, NULL, NULL, NULL, NULL, NULL, atlas_owner_id, atlas_owner_id
    ),
    (
      p_partial_leftover, trial_partial, business_atlas, 'update', 'published',
      NULL, v_now - interval '3 hours', NULL, NULL, NULL, NULL, false, NULL,
      NULL, NULL, NULL, NULL, NULL, NULL, atlas_owner_id, atlas_owner_id
    ),
    (
      p_expired_leftover, trial_expired, business_atlas, 'update', 'published',
      NULL, v_now - interval '3 hours', NULL, NULL, NULL, NULL, false, NULL,
      NULL, NULL, NULL, NULL, NULL, NULL, atlas_owner_id, atlas_owner_id
    ),
    (
      p_draft_leftover, draft_room, business_atlas, 'update', 'published',
      NULL, v_now - interval '3 hours', NULL, NULL, NULL, NULL, false, NULL,
      NULL, NULL, NULL, NULL, NULL, NULL, atlas_owner_id, atlas_owner_id
    );

  INSERT INTO public.feed_post_translations (
    post_id, venue_id, locale, title, body, updated_by
  ) VALUES
    (
      p_harbor_pinned_1, harbor_venue, 'en',
      'Harbour kitchen hours',
      'The kitchen stays open until midnight this weekend.',
      harbor_owner_id
    ),
    (
      p_harbor_pinned_1, harbor_venue, 'th',
      'เวลาเปิดครัวท่าเรือ',
      'ครัวเปิดถึงเที่ยงคืนสุดสัปดาห์นี้',
      harbor_owner_id
    ),
    (
      p_harbor_pinned_2, harbor_venue, 'en',
      'Live jazz tonight',
      'A short set starts at nine on the terrace.',
      harbor_owner_id
    ),
    (
      p_harbor_pinned_3, harbor_venue, 'en',
      'Coat check is open',
      'Leave jackets at the side door if the terrace is windy.',
      harbor_owner_id
    ),
    (
      p_harbor_ordinary, harbor_venue, 'en',
      'New mocktail list',
      'Ask the bar for the seasonal no-alcohol list.',
      harbor_owner_id
    ),
    (
      p_harbor_ordinary, harbor_venue, 'th',
      'รายการม็อกเทลใหม่',
      'ถามที่บาร์สำหรับเมนูไม่มีแอลกอฮอล์ตามฤดูกาล',
      harbor_owner_id
    ),
    (
      p_harbor_en_only, harbor_venue, 'en',
      'English-only harbour note',
      'Thai visitors see this English body until a Thai translation exists.',
      harbor_owner_id
    ),
    (
      p_harbor_extra_1, harbor_venue, 'en',
      'Harbor extra one',
      'Extra public update used to exercise bounded pagination.',
      harbor_owner_id
    ),
    (
      p_harbor_extra_2, harbor_venue, 'en',
      'Harbor extra two',
      'Extra public notice used to exercise bounded pagination.',
      harbor_owner_id
    ),
    (
      p_harbor_extra_3, harbor_venue, 'en',
      'Harbor extra three',
      'Extra public update used to exercise bounded pagination.',
      harbor_owner_id
    ),
    (
      p_harbor_extra_4, harbor_venue, 'en',
      'Harbor extra four',
      'Extra public announcement used to exercise bounded pagination.',
      harbor_owner_id
    ),
    (
      p_harbor_extra_5, harbor_venue, 'en',
      'Harbor extra five',
      'Extra public update used to exercise bounded pagination.',
      harbor_owner_id
    ),
    (
      p_harbor_extra_6, harbor_venue, 'en',
      'Harbor extra six',
      'Extra public notice used to exercise bounded pagination.',
      harbor_owner_id
    ),
    (
      p_harbor_extra_7, harbor_venue, 'en',
      'Harbor extra seven',
      'Extra public update used to exercise bounded pagination.',
      harbor_owner_id
    ),
    (
      p_harbor_extra_8, harbor_venue, 'en',
      'Harbor extra eight',
      'Extra public update used to exercise bounded pagination.',
      harbor_owner_id
    ),
    (
      p_night_public, night_orchid, 'en',
      'Doors at ten',
      'The main room opens at ten. Bring ID.',
      atlas_editor_id
    ),
    (
      p_night_public, night_orchid, 'th',
      'เปิดประตูสี่ทุ่ม',
      'ห้องหลักเปิดสี่ทุ่ม โปรดนำบัตรประชาชน',
      atlas_editor_id
    ),
    (
      p_night_draft, night_orchid, 'en',
      'Night Orchid Draft',
      'Private draft that must not appear on the public feed.',
      atlas_editor_id
    ),
    (
      p_night_pending, night_orchid, 'en',
      'Pending guest DJ note',
      'Waiting for a manager to approve this announcement.',
      atlas_editor_id
    ),
    (
      p_night_approved, night_orchid, 'en',
      'Approved unpublished note',
      'Approved privately and not yet published.',
      atlas_editor_id
    ),
    (
      p_night_scheduled, night_orchid, 'en',
      'Future closing notice',
      'This scheduled notice stays private until the listed time.',
      atlas_manager_id
    ),
    (
      p_night_due, night_orchid, 'en',
      'Due scheduled update',
      'This scheduled post is already due and should be public.',
      atlas_manager_id
    ),
    (
      p_night_archived, night_orchid, 'en',
      'Old archived update',
      'Archived and hidden from the public feed.',
      atlas_manager_id
    ),
    (
      p_night_rejected, night_orchid, 'en',
      'Rejected editable note',
      'Returned to draft after rejection so it can be edited.',
      atlas_staff_id
    ),
    (
      p_night_quarantined, night_orchid, 'en',
      'Quarantined leftover',
      'Quarantined content stays off the public feed.',
      atlas_editor_id
    ),
    (
      p_night_copy_source, night_orchid, 'en',
      'Copy source announcement',
      'Safe same-business copy starts as a new draft without this pin or media.',
      atlas_owner_id
    ),
    (
      p_restricted_public, restricted_room, 'en',
      'Restricted room notice',
      'Public readers can still see this notice.',
      atlas_owner_id
    ),
    (
      p_silent_leftover, silent_room, 'en',
      'Silent leftover',
      'Hidden because the feed module is disabled.',
      atlas_owner_id
    ),
    (
      p_partial_leftover, trial_partial, 'en',
      'Partial leftover',
      'Hidden because the feed module is disabled.',
      atlas_owner_id
    ),
    (
      p_expired_leftover, trial_expired, 'en',
      'Expired leftover',
      'Hidden because the trial entitlement ended.',
      atlas_owner_id
    ),
    (
      p_draft_leftover, draft_room, 'en',
      'Draft room leftover',
      'Hidden because the venue is unpublished.',
      atlas_owner_id
    );
END;
$$;
