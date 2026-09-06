-- Deterministic fictional offers seed. Reset-relative validity.
-- Informational promotions only. Neutral food/entertainment copy.

DO $$
DECLARE
  v_now timestamptz := pg_catalog.now();
  harbor_owner_id uuid := '00000000-0000-4000-8000-000000000010';
  atlas_owner_id uuid := '00000000-0000-4000-8000-000000000020';
  atlas_manager_id uuid := '00000000-0000-4000-8000-000000000021';
  atlas_editor_id uuid := '00000000-0000-4000-8000-000000000022';
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

  s_harbor uuid := '00000000-0000-7000-8000-000000000d01';
  s_garden uuid := '00000000-0000-7000-8000-000000000d02';
  s_restricted uuid := '00000000-0000-7000-8000-000000000d03';
  s_silent uuid := '00000000-0000-7000-8000-000000000d04';
  s_partial uuid := '00000000-0000-7000-8000-000000000d05';
  s_expired uuid := '00000000-0000-7000-8000-000000000d06';
  s_draft uuid := '00000000-0000-7000-8000-000000000d07';
  s_night uuid := '00000000-0000-7000-8000-000000000d08';

  o_harbor_active uuid := '00000000-0000-4000-8000-000000000d11';
  o_harbor_future uuid := '00000000-0000-4000-8000-000000000d12';
  o_harbor_expired uuid := '00000000-0000-4000-8000-000000000d13';
  o_harbor_draft uuid := '00000000-0000-4000-8000-000000000d14';
  o_harbor_scheduled uuid := '00000000-0000-4000-8000-000000000d15';
  o_harbor_archived uuid := '00000000-0000-4000-8000-000000000d16';
  o_harbor_en_only uuid := '00000000-0000-4000-8000-000000000d17';
  o_harbor_quarantined uuid := '00000000-0000-4000-8000-000000000d18';
  o_garden_pending uuid := '00000000-0000-4000-8000-000000000d19';
  o_garden_approved uuid := '00000000-0000-4000-8000-000000000d1a';
  o_garden_public uuid := '00000000-0000-4000-8000-000000000d1b';
  o_restricted uuid := '00000000-0000-4000-8000-000000000d1c';
  o_silent uuid := '00000000-0000-4000-8000-000000000d1d';
  o_partial uuid := '00000000-0000-4000-8000-000000000d1e';
  o_expired_ent uuid := '00000000-0000-4000-8000-000000000d1f';
  o_draft_room uuid := '00000000-0000-4000-8000-000000000d20';
  o_night_leftover uuid := '00000000-0000-4000-8000-000000000d21';
BEGIN
  UPDATE public.venue_module_entitlements
  SET ends_at = v_now + interval '30 days'
  WHERE venue_id = trial_garden
    AND module_key = 'offers'
    AND grant_type = 'allow'
    AND revoked_at IS NULL;

  INSERT INTO public.venue_memberships (
    id, venue_id, user_id, role, status, invited_by, accepted_at, created_at, updated_at
  )
  VALUES
    (
      '00000000-0000-4000-8000-000000000d30',
      trial_garden,
      atlas_editor_id,
      'content_editor',
      'active',
      atlas_owner_id,
      v_now,
      v_now,
      v_now
    ),
    (
      '00000000-0000-4000-8000-000000000d31',
      trial_garden,
      atlas_manager_id,
      'venue_manager',
      'active',
      atlas_owner_id,
      v_now,
      v_now,
      v_now
    )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.venue_module_settings (
    id, venue_id, module_key, is_enabled, is_publicly_visible, display_order,
    settings, updated_by, created_at, updated_at
  )
  VALUES
    (s_harbor, harbor_venue, 'offers',
      app_private.module_is_entitled(harbor_venue, 'offers'),
      true, 9,
      '{"require_manager_approval":false,"homepage_preview_enabled":true,"homepage_preview_count":3}'::jsonb,
      harbor_owner_id, v_now, v_now),
    (s_garden, trial_garden, 'offers',
      app_private.module_is_entitled(trial_garden, 'offers'),
      true, 9,
      '{"require_manager_approval":true,"homepage_preview_enabled":true,"homepage_preview_count":2}'::jsonb,
      atlas_owner_id, v_now, v_now),
    (s_restricted, restricted_room, 'offers',
      app_private.module_is_entitled(restricted_room, 'offers'),
      true, 9,
      '{"require_manager_approval":false,"homepage_preview_enabled":true,"homepage_preview_count":3}'::jsonb,
      atlas_owner_id, v_now, v_now),
    (s_silent, silent_room, 'offers',
      app_private.module_is_entitled(silent_room, 'offers'),
      true, 9,
      '{"require_manager_approval":false,"homepage_preview_enabled":true,"homepage_preview_count":3}'::jsonb,
      atlas_owner_id, v_now, v_now),
    (s_partial, trial_partial, 'offers', false, false, 9,
      '{"require_manager_approval":false,"homepage_preview_enabled":false,"homepage_preview_count":3}'::jsonb,
      atlas_owner_id, v_now, v_now),
    (s_expired, trial_expired, 'offers', false, false, 9,
      '{"require_manager_approval":false,"homepage_preview_enabled":false,"homepage_preview_count":3}'::jsonb,
      atlas_owner_id, v_now, v_now),
    (s_draft, draft_room, 'offers', false, false, 9,
      '{"require_manager_approval":false,"homepage_preview_enabled":false,"homepage_preview_count":3}'::jsonb,
      atlas_owner_id, v_now, v_now),
    (s_night, night_orchid, 'offers', false, false, 9,
      '{"require_manager_approval":true,"homepage_preview_enabled":false,"homepage_preview_count":3}'::jsonb,
      atlas_owner_id, v_now, v_now)
  ON CONFLICT (venue_id, module_key) DO UPDATE SET
    is_enabled = EXCLUDED.is_enabled,
    is_publicly_visible = EXCLUDED.is_publicly_visible,
    settings = EXCLUDED.settings,
    updated_by = EXCLUDED.updated_by,
    updated_at = EXCLUDED.updated_at;

  INSERT INTO public.venue_module_setting_translations (
    id, venue_module_setting_id, venue_id, locale, public_heading,
    created_at, updated_at, updated_by
  )
  VALUES
    ('00000000-0000-7000-8000-000000000e01', s_harbor, harbor_venue, 'en',
      'This week at Harbor Light', v_now, v_now, harbor_owner_id),
    ('00000000-0000-7000-8000-000000000e02', s_harbor, harbor_venue, 'th',
      'สัปดาห์นี้ที่ฮาร์เบอร์ไลต์', v_now, v_now, harbor_owner_id),
    ('00000000-0000-7000-8000-000000000e03', s_garden, trial_garden, 'en',
      'Garden promotions', v_now, v_now, atlas_owner_id)
  ON CONFLICT (venue_module_setting_id, locale) DO UPDATE SET
    public_heading = EXCLUDED.public_heading,
    updated_by = EXCLUDED.updated_by,
    updated_at = EXCLUDED.updated_at;

  INSERT INTO public.offers (
    id, venue_id, business_id, state, valid_from, valid_until,
    scheduled_for, published_at, submitted_by, approved_by, approved_at,
    archived_at, platform_quarantined_at, platform_quarantine_reason,
    platform_quarantined_by, created_by, updated_by, created_at, updated_at
  )
  VALUES
    (o_harbor_active, harbor_venue, business_harbor, 'published',
      v_now - interval '2 days', v_now + interval '14 days',
      NULL, v_now - interval '2 days', NULL, NULL, NULL,
      NULL, NULL, NULL, NULL, harbor_owner_id, harbor_owner_id, v_now, v_now),
    (o_harbor_future, harbor_venue, business_harbor, 'published',
      v_now + interval '7 days', v_now + interval '21 days',
      NULL, v_now - interval '1 day', NULL, NULL, NULL,
      NULL, NULL, NULL, NULL, harbor_owner_id, harbor_owner_id, v_now, v_now),
    (o_harbor_expired, harbor_venue, business_harbor, 'published',
      v_now - interval '21 days', v_now - interval '1 day',
      NULL, v_now - interval '20 days', NULL, NULL, NULL,
      NULL, NULL, NULL, NULL, harbor_owner_id, harbor_owner_id, v_now, v_now),
    (o_harbor_draft, harbor_venue, business_harbor, 'draft',
      v_now + interval '1 day', v_now + interval '10 days',
      NULL, NULL, NULL, NULL, NULL,
      NULL, NULL, NULL, NULL, harbor_owner_id, harbor_owner_id, v_now, v_now),
    (o_harbor_scheduled, harbor_venue, business_harbor, 'scheduled',
      v_now - interval '1 day', v_now + interval '12 days',
      v_now + interval '2 days', NULL, NULL, NULL, NULL,
      NULL, NULL, NULL, NULL, harbor_owner_id, harbor_owner_id, v_now, v_now),
    (o_harbor_archived, harbor_venue, business_harbor, 'archived',
      v_now - interval '3 days', v_now + interval '10 days',
      NULL, v_now - interval '3 days', NULL, NULL, NULL,
      v_now - interval '1 hour', NULL, NULL, NULL,
      harbor_owner_id, harbor_owner_id, v_now, v_now),
    (o_harbor_en_only, harbor_venue, business_harbor, 'published',
      v_now - interval '1 day', v_now + interval '9 days',
      NULL, v_now - interval '1 day', NULL, NULL, NULL,
      NULL, NULL, NULL, NULL, harbor_owner_id, harbor_owner_id, v_now, v_now),
    (o_harbor_quarantined, harbor_venue, business_harbor, 'draft',
      v_now - interval '1 day', v_now + interval '8 days',
      NULL, NULL, NULL, NULL, NULL,
      NULL, v_now - interval '30 minutes', 'Fictional moderation fixture',
      admin_id, harbor_owner_id, harbor_owner_id, v_now, v_now),
    (o_garden_pending, trial_garden, business_atlas, 'pending_approval',
      v_now - interval '1 day', v_now + interval '10 days',
      NULL, NULL, atlas_editor_id, NULL, NULL,
      NULL, NULL, NULL, NULL, atlas_editor_id, atlas_editor_id, v_now, v_now),
    (o_garden_approved, trial_garden, business_atlas, 'draft',
      v_now - interval '1 day', v_now + interval '11 days',
      NULL, NULL, atlas_editor_id, atlas_manager_id, v_now - interval '10 minutes',
      NULL, NULL, NULL, NULL, atlas_editor_id, atlas_manager_id, v_now, v_now),
    (o_garden_public, trial_garden, business_atlas, 'published',
      v_now - interval '1 day', v_now + interval '13 days',
      NULL, v_now - interval '12 hours', atlas_editor_id, atlas_manager_id,
      v_now - interval '13 hours',
      NULL, NULL, NULL, NULL, atlas_owner_id, atlas_owner_id, v_now, v_now),
    (o_restricted, restricted_room, business_atlas, 'published',
      v_now - interval '1 day', v_now + interval '7 days',
      NULL, v_now - interval '1 day', NULL, NULL, NULL,
      NULL, NULL, NULL, NULL, atlas_owner_id, atlas_owner_id, v_now, v_now),
    (o_silent, silent_room, business_atlas, 'published',
      v_now - interval '1 day', v_now + interval '7 days',
      NULL, v_now - interval '1 day', NULL, NULL, NULL,
      NULL, NULL, NULL, NULL, atlas_owner_id, atlas_owner_id, v_now, v_now),
    (o_partial, trial_partial, business_atlas, 'published',
      v_now - interval '1 day', v_now + interval '7 days',
      NULL, v_now - interval '1 day', NULL, NULL, NULL,
      NULL, NULL, NULL, NULL, atlas_owner_id, atlas_owner_id, v_now, v_now),
    (o_expired_ent, trial_expired, business_atlas, 'published',
      v_now - interval '1 day', v_now + interval '7 days',
      NULL, v_now - interval '1 day', NULL, NULL, NULL,
      NULL, NULL, NULL, NULL, atlas_owner_id, atlas_owner_id, v_now, v_now),
    (o_draft_room, draft_room, business_atlas, 'published',
      v_now - interval '1 day', v_now + interval '7 days',
      NULL, v_now - interval '1 day', NULL, NULL, NULL,
      NULL, NULL, NULL, NULL, atlas_owner_id, atlas_owner_id, v_now, v_now),
    (o_night_leftover, night_orchid, business_atlas, 'published',
      v_now - interval '1 day', v_now + interval '7 days',
      NULL, v_now - interval '1 day', NULL, NULL, NULL,
      NULL, NULL, NULL, NULL, atlas_owner_id, atlas_owner_id, v_now, v_now)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.offer_translations (
    offer_id, venue_id, locale, title, description, terms, updated_by
  )
  VALUES
    (o_harbor_active, harbor_venue, 'en',
      'Weekday lunch set',
      'A fictional two-course lunch for tables booked before 14:00.',
      'Informational only. Ask the venue. This does not guarantee a table.',
      harbor_owner_id),
    (o_harbor_active, harbor_venue, 'th',
      'ชุดอาหารกลางวันวันธรรมดา',
      'ชุดอาหารกลางวันสมมติสองจานสำหรับโต๊ะก่อน 14:00 น.',
      'ข้อมูลเท่านั้น ถามทางร้าน ไม่รับประกันโต๊ะ',
      harbor_owner_id),
    (o_harbor_future, harbor_venue, 'en',
      'Weekend tasting preview',
      'A fictional tasting menu that starts next week.',
      'Not yet valid. Ask the venue when it starts.',
      harbor_owner_id),
    (o_harbor_expired, harbor_venue, 'en',
      'Last month garden plate',
      'A fictional plate that has already ended.',
      'This promotion has ended.',
      harbor_owner_id),
    (o_harbor_draft, harbor_venue, 'en',
      'Draft harbour snack',
      'Private draft copy for local testing.',
      'Draft terms stay off the public site.',
      harbor_owner_id),
    (o_harbor_scheduled, harbor_venue, 'en',
      'Scheduled harbour dessert',
      'A fictional dessert notice waiting for publication time.',
      'Not public until the schedule is reached and the dates are valid.',
      harbor_owner_id),
    (o_harbor_archived, harbor_venue, 'en',
      'Archived harbour tea',
      'A fictional archived promotion.',
      'Archived content is private.',
      harbor_owner_id),
    (o_harbor_en_only, harbor_venue, 'en',
      'English-only harbour salad',
      'Thai copy is intentionally absent so public pages fall back to English.',
      'Informational only.',
      harbor_owner_id),
    (o_harbor_quarantined, harbor_venue, 'en',
      'Quarantined harbour notice',
      'This fictional row is quarantined and must stay off the public site.',
      'Not public.',
      harbor_owner_id),
    (o_garden_pending, trial_garden, 'en',
      'Pending garden pastry',
      'Awaiting manager approval in the trial garden.',
      'Private until approved and published.',
      atlas_editor_id),
    (o_garden_approved, trial_garden, 'en',
      'Approved garden soup',
      'Approved current content waiting for publication.',
      'Still a private draft until published.',
      atlas_editor_id),
    (o_garden_public, trial_garden, 'en',
      'Garden fruit plate',
      'A fictional fruit plate during the trial.',
      'Informational only. Ask the venue.',
      atlas_owner_id),
    (o_restricted, restricted_room, 'en',
      'Restricted room snack',
      'Leftover public copy while the venue is restricted.',
      'Informational only.',
      atlas_owner_id),
    (o_silent, silent_room, 'en',
      'Silent room leftover',
      'Must not appear while the venue is suspended.',
      'Not public during suspension.',
      atlas_owner_id),
    (o_partial, trial_partial, 'en',
      'Partial trial leftover',
      'Offers are not entitled here.',
      'Must stay hidden.',
      atlas_owner_id),
    (o_expired_ent, trial_expired, 'en',
      'Expired trial leftover',
      'Offers entitlement has ended.',
      'Must stay hidden.',
      atlas_owner_id),
    (o_draft_room, draft_room, 'en',
      'Draft room leftover',
      'Unpublished venue leftover.',
      'Must stay hidden.',
      atlas_owner_id),
    (o_night_leftover, night_orchid, 'en',
      'Night leftover',
      'Offers are denied for this venue.',
      'Must stay hidden.',
      atlas_owner_id)
  ON CONFLICT (offer_id, locale) DO NOTHING;

  INSERT INTO public.offer_events (
    offer_id, venue_id, action, from_state, to_state, actor_user_id, created_at
  )
  VALUES
    (o_harbor_active, harbor_venue, 'created', NULL, 'draft', harbor_owner_id, v_now),
    (o_harbor_active, harbor_venue, 'published', 'draft', 'published', harbor_owner_id, v_now),
    (o_garden_pending, trial_garden, 'created', NULL, 'draft', atlas_editor_id, v_now),
    (o_garden_pending, trial_garden, 'submitted', 'draft', 'pending_approval', atlas_editor_id, v_now);
END;
$$;
