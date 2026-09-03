-- Deterministic fictional events/calendar seed.
-- No real customers or tenant media.

DO $$
DECLARE
  v_now timestamptz := pg_catalog.now();
  v_tz text := 'Asia/Bangkok';
  v_today date := (pg_catalog.now() AT TIME ZONE v_tz)::date;

  harbor_owner_id uuid := '00000000-0000-4000-8000-000000000010';
  atlas_owner_id uuid := '00000000-0000-4000-8000-000000000020';
  atlas_manager_id uuid := '00000000-0000-4000-8000-000000000021';
  atlas_editor_id uuid := '00000000-0000-4000-8000-000000000022';
  atlas_staff_id uuid := '00000000-0000-4000-8000-000000000024';
  dual_staff_id uuid := '00000000-0000-4000-8000-000000000027';

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

  -- Event UUID namespace (stable identifiers)
  e_night_draft uuid := '00000000-0000-4000-8000-000000000401';
  e_night_pending uuid := '00000000-0000-4000-8000-000000000402';
  e_night_approved_draft uuid := '00000000-0000-4000-8000-000000000403';
  e_night_scheduled_future uuid := '00000000-0000-4000-8000-000000000404';
  e_night_public_upcoming uuid := '00000000-0000-4000-8000-000000000405';
  e_night_overnight uuid := '00000000-0000-4000-8000-000000000406';
  e_night_past uuid := '00000000-0000-4000-8000-000000000407';
  e_night_cancelled uuid := '00000000-0000-4000-8000-000000000408';
  e_night_archived uuid := '00000000-0000-4000-8000-000000000409';
  e_night_quarantined uuid := '00000000-0000-4000-8000-00000000040a';
  e_night_en_only uuid := '00000000-0000-4000-8000-00000000040b';
  e_night_copy_source uuid := '00000000-0000-4000-8000-00000000040c';

  e_harbor_public_upcoming uuid := '00000000-0000-4000-8000-000000000410';
  e_restricted_public_upcoming uuid := '00000000-0000-4000-8000-000000000411';
  e_partial_disabled_public_upcoming uuid := '00000000-0000-4000-8000-000000000412';
  e_trial_expired_public_upcoming uuid := '00000000-0000-4000-8000-000000000413';
  e_draft_room_public_like uuid := '00000000-0000-4000-8000-000000000414';

  -- Venue module setting ids (stable)
  s_harbor uuid := '00000000-0000-5000-8000-000000000901';
  s_night uuid := '00000000-0000-5000-8000-000000000902';
  s_draft uuid := '00000000-0000-5000-8000-000000000903';
  s_restricted uuid := '00000000-0000-5000-8000-000000000904';
  s_silent uuid := '00000000-0000-5000-8000-000000000905';
  s_trial_garden uuid := '00000000-0000-5000-8000-000000000906';
  s_trial_partial uuid := '00000000-0000-5000-8000-000000000907';
  s_trial_expired uuid := '00000000-0000-5000-8000-000000000908';

  -- Start/end instants (relative to seed/reset time)
  v_public_start timestamptz := v_now + interval '3 hours';
  v_public_end timestamptz := v_now + interval '5 hours';
  v_future_start timestamptz := v_now + interval '2 days';
  v_future_end timestamptz := v_now + interval '2 days 3 hours';
  v_past_start timestamptz := v_now - interval '6 days';
  v_past_end timestamptz := v_now - interval '4 days';
  v_overnight_start timestamptz := (
    date_trunc('day', (v_now AT TIME ZONE v_tz))
    + interval '22 hours'
  ) AT TIME ZONE v_tz;
  v_overnight_end timestamptz := v_overnight_start + interval '3 hours';
  v_copy_source_start timestamptz := v_now + interval '4 hours';
  v_copy_source_end timestamptz := v_now + interval '7 hours';

  v_scheduled_start timestamptz := v_now + interval '2 days 4 hours';
  v_scheduled_end timestamptz := v_now + interval '2 days 7 hours';

  v_copy_poster_path text;
BEGIN
  -- Events module entitlement for trial_partial (entitled but disabled)
  INSERT INTO public.venue_module_entitlements (
    venue_id, module_key, source_key, grant_type, starts_at, ends_at,
    granted_by, reason
  )
  SELECT
    trial_partial,
    'events',
    'trial',
    'allow',
    v_now - interval '1 day',
    v_now + interval '60 days',
    atlas_owner_id,
    'Trial partial events entitlement for local testing'
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.venue_module_entitlements e
    WHERE e.venue_id = trial_partial
      AND e.module_key = 'events'
      AND e.revoked_at IS NULL
      AND e.starts_at <= v_now
      AND (e.ends_at IS NULL OR e.ends_at > v_now)
  );

  -- Module settings + headings for every venue we seed events into.
  INSERT INTO public.venue_module_settings (
    id, venue_id, module_key, is_enabled, is_publicly_visible, display_order,
    settings, updated_by, created_at, updated_at
  )
  VALUES
    (s_harbor, harbor_venue, 'events', true, true, 1,
      '{"default_display":"calendar_and_list","max_upcoming":24,"horizon_days":120,"show_past_archive":true,"event_order":"starts_at_asc","require_manager_approval":false}'::jsonb,
      harbor_owner_id, v_now, v_now),
    (s_night, night_orchid, 'events', true, true, 1,
      '{"default_display":"calendar_and_list","max_upcoming":24,"horizon_days":120,"show_past_archive":true,"event_order":"starts_at_asc","require_manager_approval":true}'::jsonb,
      atlas_owner_id, v_now, v_now),
    (s_draft, draft_room, 'events', false, false, 1,
      '{"default_display":"calendar_and_list","max_upcoming":24,"horizon_days":120,"show_past_archive":false,"event_order":"starts_at_asc","require_manager_approval":false}'::jsonb,
      atlas_owner_id, v_now, v_now),
    (s_restricted, restricted_room, 'events', true, true, 1,
      '{"default_display":"calendar_and_list","max_upcoming":24,"horizon_days":120,"show_past_archive":false,"event_order":"starts_at_asc","require_manager_approval":false}'::jsonb,
      atlas_owner_id, v_now, v_now),
    (s_silent, silent_room, 'events', false, false, 1,
      '{"default_display":"calendar_and_list","max_upcoming":24,"horizon_days":120,"show_past_archive":false,"event_order":"starts_at_asc","require_manager_approval":false}'::jsonb,
      atlas_owner_id, v_now, v_now),
    (s_trial_garden, trial_garden, 'events', true, true, 1,
      '{"default_display":"calendar_and_list","max_upcoming":24,"horizon_days":120,"show_past_archive":false,"event_order":"starts_at_asc","require_manager_approval":false}'::jsonb,
      atlas_owner_id, v_now, v_now),
    (s_trial_partial, trial_partial, 'events', false, true, 1,
      '{"default_display":"calendar_and_list","max_upcoming":24,"horizon_days":120,"show_past_archive":false,"event_order":"starts_at_asc","require_manager_approval":false}'::jsonb,
      atlas_owner_id, v_now, v_now),
    (s_trial_expired, trial_expired, 'events', false, false, 1,
      '{"default_display":"calendar_and_list","max_upcoming":24,"horizon_days":120,"show_past_archive":false,"event_order":"starts_at_asc","require_manager_approval":false}'::jsonb,
      atlas_owner_id, v_now, v_now)
  ON CONFLICT (venue_id, module_key) DO UPDATE SET
    is_enabled = EXCLUDED.is_enabled,
    is_publicly_visible = EXCLUDED.is_publicly_visible,
    settings = EXCLUDED.settings,
    updated_by = EXCLUDED.updated_by,
    updated_at = EXCLUDED.updated_at;

  INSERT INTO public.venue_module_setting_translations (
    id, venue_module_setting_id, venue_id, locale, public_heading, created_at, updated_at, updated_by
  )
  VALUES
    ('00000000-0000-5000-8000-000000000910', s_harbor, harbor_venue, 'en', 'Upcoming at Harbor Light', v_now, v_now, harbor_owner_id),
    ('00000000-0000-5000-8000-000000000911', s_harbor, harbor_venue, 'th', 'กิจกรรมที่จะมีที่ท่าเรือ', v_now, v_now, harbor_owner_id),

    ('00000000-0000-5000-8000-000000000912', s_night, night_orchid, 'en', 'Tonight at Night Orchid', v_now, v_now, atlas_owner_id),
    ('00000000-0000-5000-8000-000000000913', s_night, night_orchid, 'th', 'ค่ำคืนที่ดอกกล้วยไม้', v_now, v_now, atlas_owner_id),

    ('00000000-0000-5000-8000-000000000914', s_trial_garden, trial_garden, 'en', 'Garden hosts', v_now, v_now, atlas_owner_id),
    ('00000000-0000-5000-8000-000000000915', s_trial_garden, trial_garden, 'th', 'ผู้จัดสวน', v_now, v_now, atlas_owner_id),

    ('00000000-0000-5000-8000-000000000916', s_trial_partial, trial_partial, 'en', 'Trial partial heading', v_now, v_now, atlas_owner_id),
    ('00000000-0000-5000-8000-000000000917', s_trial_partial, trial_partial, 'th', 'หัวข้อทดลอง (บางส่วน)', v_now, v_now, atlas_owner_id),

    ('00000000-0000-5000-8000-000000000918', s_trial_expired, trial_expired, 'en', 'Expired trial heading', v_now, v_now, atlas_owner_id),
    ('00000000-0000-5000-8000-000000000919', s_trial_expired, trial_expired, 'th', 'หัวข้อหมดอายุแล้ว', v_now, v_now, atlas_owner_id),

    ('00000000-0000-5000-8000-000000000920', s_draft, draft_room, 'en', 'Draft venue events', v_now, v_now, atlas_owner_id),
    ('00000000-0000-5000-8000-000000000921', s_draft, draft_room, 'th', 'กิจกรรมของสถานที่ร่าง', v_now, v_now, atlas_owner_id),

    ('00000000-0000-5000-8000-000000000922', s_restricted, restricted_room, 'en', 'Restricted venue events', v_now, v_now, atlas_owner_id),
    ('00000000-0000-5000-8000-000000000923', s_restricted, restricted_room, 'th', 'กิจกรรมในสถานที่ที่จำกัด', v_now, v_now, atlas_owner_id),

    ('00000000-0000-5000-8000-000000000924', s_silent, silent_room, 'en', 'Silent venue events', v_now, v_now, atlas_owner_id),
    ('00000000-0000-5000-8000-000000000925', s_silent, silent_room, 'th', 'กิจกรรมในสถานที่เงียบ', v_now, v_now, atlas_owner_id);

  -- Ensure the overnight fixture is still upcoming at seed/reset time.
  IF v_overnight_end <= v_now THEN
    v_overnight_start := v_overnight_start + interval '1 day';
    v_overnight_end := v_overnight_end + interval '1 day';
  END IF;

  -- Core event instants.
  v_copy_poster_path := 'venues/' || night_orchid::text || '/events/' || e_night_copy_source::text || '/poster.png';

  INSERT INTO public.events (
    id, venue_id, business_id, starts_at, ends_at, timezone, is_all_day,
    state, approval_status, publish_at, published_at,
    cancelled_at, cancellation_reason,
    archived_at,
    poster_storage_path,
    source_event_id, source_venue_id,
    platform_quarantined_at, platform_quarantine_reason, platform_quarantined_by,
    created_by, updated_by, created_at, updated_at
  )
  VALUES
    -- Night Orchid: draft event (editable, not public)
    (e_night_draft, night_orchid, business_atlas,
      v_public_start, v_public_end, v_tz, false,
      'draft', 'not_submitted',
      NULL, NULL,
      NULL, NULL,
      NULL,
      NULL,
      NULL, NULL,
      NULL, NULL, NULL,
      atlas_editor_id, atlas_editor_id, v_now, v_now),

    -- Pending approval draft (public hidden)
    (e_night_pending, night_orchid, business_atlas,
      v_public_start + interval '6 hours', v_public_end + interval '6 hours', v_tz, false,
      'draft', 'pending',
      NULL, NULL,
      NULL, NULL,
      NULL,
      NULL,
      NULL, NULL,
      NULL, NULL, NULL,
      atlas_editor_id, atlas_editor_id, v_now, v_now),

    -- Approved but still draft (public hidden)
    (e_night_approved_draft, night_orchid, business_atlas,
      v_public_start + interval '12 hours', v_public_end + interval '12 hours', v_tz, false,
      'draft', 'approved',
      NULL, NULL,
      NULL, NULL,
      NULL,
      NULL,
      NULL, NULL,
      NULL, NULL, NULL,
      atlas_manager_id, atlas_manager_id, v_now, v_now),

    -- Scheduled for future publication (hidden until publish_at arrives)
    (e_night_scheduled_future, night_orchid, business_atlas,
      v_scheduled_start, v_scheduled_end, v_tz, false,
      'scheduled', 'approved',
      v_now + interval '2 days', NULL,
      NULL, NULL,
      NULL,
      NULL,
      NULL, NULL,
      NULL, NULL, NULL,
      atlas_manager_id, atlas_manager_id, v_now, v_now),

    -- Currently public upcoming event
    (e_night_public_upcoming, night_orchid, business_atlas,
      v_public_start, v_public_end, v_tz, false,
      'published', 'approved',
      NULL, v_now,
      NULL, NULL,
      NULL,
      NULL,
      NULL, NULL,
      NULL, NULL, NULL,
      atlas_manager_id, atlas_manager_id, v_now, v_now),

    -- Overnight published event (crosses local midnight)
    (e_night_overnight, night_orchid, business_atlas,
      v_overnight_start, v_overnight_end, v_tz, false,
      'published', 'approved',
      NULL, v_now,
      NULL, NULL,
      NULL,
      NULL,
      NULL, NULL,
      NULL, NULL, NULL,
      atlas_manager_id, atlas_manager_id, v_now, v_now),

    -- Past published event
    (e_night_past, night_orchid, business_atlas,
      v_past_start, v_past_end, v_tz, false,
      'published', 'approved',
      NULL, v_now - interval '10 days',
      NULL, NULL,
      NULL,
      NULL,
      NULL, NULL,
      NULL, NULL, NULL,
      atlas_manager_id, atlas_manager_id, v_now, v_now),

    -- Cancelled event
    (e_night_cancelled, night_orchid, business_atlas,
      v_public_start + interval '1 day', v_public_end + interval '1 day', v_tz, false,
      'cancelled', 'approved',
      NULL, NULL,
      v_now, 'Cancelled for local testing',
      NULL,
      NULL,
      NULL, NULL,
      NULL, NULL, NULL,
      atlas_manager_id, atlas_manager_id, v_now, v_now),

    -- Archived event
    (e_night_archived, night_orchid, business_atlas,
      v_public_start + interval '2 days', v_public_end + interval '2 days', v_tz, false,
      'archived', 'approved',
      NULL, NULL,
      NULL, NULL,
      v_now,
      NULL,
      NULL, NULL,
      NULL, NULL, NULL,
      atlas_manager_id, atlas_manager_id, v_now, v_now),

    -- Quarantined event (not public)
    (e_night_quarantined, night_orchid, business_atlas,
      v_public_start + interval '3 days', v_public_end + interval '3 days', v_tz, false,
      'draft', 'not_submitted',
      NULL, NULL,
      NULL, NULL,
      NULL,
      NULL,
      NULL, NULL,
      v_now, 'platform quarantine for local testing', atlas_manager_id,
      atlas_staff_id, atlas_staff_id, v_now, v_now),

    -- EN-only translation: Thai fallback required.
    (e_night_en_only, night_orchid, business_atlas,
      v_public_start + interval '4 days', v_public_end + interval '4 days', v_tz, false,
      'published', 'approved',
      NULL, v_now,
      NULL, NULL,
      NULL,
      NULL,
      NULL, NULL,
      NULL, NULL, NULL,
      atlas_manager_id, atlas_manager_id, v_now, v_now),

    -- Copy source event (same-business copy). Includes poster path.
    (e_night_copy_source, night_orchid, business_atlas,
      v_copy_source_start, v_copy_source_end, v_tz, false,
      'published', 'approved',
      NULL, v_now,
      NULL, NULL,
      NULL,
      v_copy_poster_path,
      NULL, NULL,
      NULL, NULL, NULL,
      dual_staff_id, dual_staff_id, v_now, v_now),

    -- Harbor Light public event
    (e_harbor_public_upcoming, harbor_venue, business_harbor,
      v_public_start, v_public_end, v_tz, false,
      'published', 'approved',
      NULL, v_now,
      NULL, NULL,
      NULL,
      NULL,
      NULL, NULL,
      NULL, NULL, NULL,
      harbor_owner_id, harbor_owner_id, v_now, v_now),

    -- Restricted-room public event (public read allowed)
    (e_restricted_public_upcoming, restricted_room, business_atlas,
      v_public_start + interval '1 hour', v_public_end + interval '1 hour', v_tz, false,
      'published', 'approved',
      NULL, v_now,
      NULL, NULL,
      NULL,
      NULL,
      NULL, NULL,
      NULL, NULL, NULL,
      atlas_owner_id, atlas_owner_id, v_now, v_now),

    -- Trial-partial: module disabled (public hidden but still entitled for admin tests)
    (e_partial_disabled_public_upcoming, trial_partial, business_atlas,
      v_public_start + interval '2 hours', v_public_end + interval '2 hours', v_tz, false,
      'published', 'approved',
      NULL, v_now,
      NULL, NULL,
      NULL,
      NULL,
      NULL, NULL,
      NULL, NULL, NULL,
      atlas_owner_id, atlas_owner_id, v_now, v_now),

    -- Trial-expired: not entitled for module (public hidden)
    (e_trial_expired_public_upcoming, trial_expired, business_atlas,
      v_public_start + interval '3 hours', v_public_end + interval '3 hours', v_tz, false,
      'published', 'approved',
      NULL, v_now,
      NULL, NULL,
      NULL,
      NULL,
      NULL, NULL,
      NULL, NULL, NULL,
      atlas_owner_id, atlas_owner_id, v_now, v_now),

    -- Draft-room: venue not publicly visible (public hidden)
    (e_draft_room_public_like, draft_room, business_atlas,
      v_public_start + interval '4 hours', v_public_end + interval '4 hours', v_tz, false,
      'published', 'approved',
      NULL, v_now,
      NULL, NULL,
      NULL,
      NULL,
      NULL, NULL,
      NULL, NULL, NULL,
      atlas_owner_id, atlas_owner_id, v_now, v_now)
  ;

  -- Translations (EN always present; Thai optional for fallback tests)
  INSERT INTO public.event_translations (
    event_id, venue_id, locale, title, summary, description, cta_label, updated_by
  )
  VALUES
    -- Night Orchid
    (e_night_draft, night_orchid, 'en', 'Night Orchid Draft', 'Draft summary', NULL, NULL, atlas_editor_id),
    (e_night_draft, night_orchid, 'th', 'ร่างกิจกรรมดอกกล้วยไม้', 'สรุปฉบับร่าง', NULL, NULL, atlas_editor_id),

    (e_night_pending, night_orchid, 'en', 'Pending Approval', 'Pending summary', NULL, NULL, atlas_editor_id),
    (e_night_pending, night_orchid, 'th', 'รอการอนุมัติ', 'สรุปรออนุมัติ', NULL, NULL, atlas_editor_id),

    (e_night_approved_draft, night_orchid, 'en', 'Approved Draft', 'Approved but hidden', NULL, NULL, atlas_manager_id),
    (e_night_approved_draft, night_orchid, 'th', 'ร่างที่ได้รับอนุมัติแล้ว', 'ยังไม่เผยแพร่', NULL, NULL, atlas_manager_id),

    (e_night_scheduled_future, night_orchid, 'en', 'Scheduled Future Night', 'Scheduled for later', NULL, NULL, atlas_manager_id),
    (e_night_scheduled_future, night_orchid, 'th', 'คืองานที่กำหนดในอนาคต', 'กำหนดเวลาภายหลัง', NULL, NULL, atlas_manager_id),

    (e_night_public_upcoming, night_orchid, 'en', 'Orchid Open Night', 'A public upcoming event', NULL, 'View details', atlas_manager_id),
    (e_night_public_upcoming, night_orchid, 'th', 'คืนดอกกล้วยไม้เปิด', 'กิจกรรมสาธารณะกำลังจะมา', NULL, 'ดูรายละเอียด', atlas_manager_id),

    (e_night_overnight, night_orchid, 'en', 'Overnight Set', 'Crosses midnight', NULL, 'See times', atlas_manager_id),
    (e_night_overnight, night_orchid, 'th', 'เซ็ตข้ามคืน', 'ข้ามเที่ยงคืน', NULL, 'ดูเวลา', atlas_manager_id),

    (e_night_past, night_orchid, 'en', 'Past Show', 'This one already ended', NULL, NULL, atlas_manager_id),
    (e_night_past, night_orchid, 'th', 'งานที่จบไปแล้ว', 'จบแล้ว', NULL, NULL, atlas_manager_id),

    (e_night_cancelled, night_orchid, 'en', 'Cancelled Night', NULL, NULL, NULL, atlas_manager_id),
    (e_night_cancelled, night_orchid, 'th', 'คืนที่ยกเลิกแล้ว', NULL, NULL, NULL, atlas_manager_id),

    (e_night_archived, night_orchid, 'en', 'Archived Night', NULL, NULL, NULL, atlas_manager_id),
    (e_night_archived, night_orchid, 'th', 'คืนที่เก็บถาวร', NULL, NULL, NULL, atlas_manager_id),

    (e_night_quarantined, night_orchid, 'en', 'Quarantined Draft', 'Hidden by platform quarantine', NULL, NULL, atlas_staff_id),
    (e_night_quarantined, night_orchid, 'th', 'ร่างที่ถูกกักกัน', 'ซ่อนโดยแพลตฟอร์ม', NULL, NULL, atlas_staff_id),

    -- EN-only translation: Thai fallback.
    (e_night_en_only, night_orchid, 'en', 'EN Only Event', 'Should display EN on Thai page', NULL, NULL, atlas_manager_id),

    -- Copy source translations include both EN/TH.
    (e_night_copy_source, night_orchid, 'en', 'Copy Source Event', 'Source for same-business copy', NULL, NULL, dual_staff_id),
    (e_night_copy_source, night_orchid, 'th', 'อีเวนต์ต้นทางสำหรับการคัดลอก', 'ต้นทางสำหรับการคัดลอกแบบธุรกิจเดียวกัน', NULL, NULL, dual_staff_id),

    -- Harbor
    (e_harbor_public_upcoming, harbor_venue, 'en', 'Harbor Upcoming', 'Harbor upcoming event', NULL, NULL, harbor_owner_id),
    (e_harbor_public_upcoming, harbor_venue, 'th', 'กิจกรรมที่กำลังจะมาที่ท่าเรือ', 'กิจกรรม', NULL, NULL, harbor_owner_id),

    -- Restricted
    (e_restricted_public_upcoming, restricted_room, 'en', 'Restricted Room Public', 'Public read allowed, writes blocked', NULL, NULL, atlas_owner_id),
    (e_restricted_public_upcoming, restricted_room, 'th', 'ห้องที่จำกัด (อ่านได้)', 'อ่านได้ แต่เขียนไม่ได้', NULL, NULL, atlas_owner_id),

    -- Trial partial disabled
    (e_partial_disabled_public_upcoming, trial_partial, 'en', 'Disabled Module Public', 'Module is entitled but disabled', NULL, NULL, atlas_owner_id),
    (e_partial_disabled_public_upcoming, trial_partial, 'th', 'โมดูลที่ปิดการแสดง', 'มีสิทธิ์แต่ปิดการแสดง', NULL, NULL, atlas_owner_id),

    -- Trial expired
    (e_trial_expired_public_upcoming, trial_expired, 'en', 'Expired Entitlement Public', 'Should stay hidden', NULL, NULL, atlas_owner_id),
    (e_trial_expired_public_upcoming, trial_expired, 'th', 'สิทธิ์หมดอายุแล้ว', 'ควรถูกซ่อน', NULL, NULL, atlas_owner_id),

    -- Draft room (venue draft)
    (e_draft_room_public_like, draft_room, 'en', 'Draft Venue Public-Like', 'Venue is not publicly visible', NULL, NULL, atlas_owner_id),
    (e_draft_room_public_like, draft_room, 'th', 'สถานะร่างของสถานที่', 'สถานที่ไม่เผยแพร่', NULL, NULL, atlas_owner_id);

  -- Minimal workflow history records for admin display.
  INSERT INTO public.event_workflow_events (
    event_id, venue_id, action, from_state, to_state, from_approval, to_approval, actor_user_id
  )
  VALUES
    (e_night_draft, night_orchid, 'create', NULL, 'draft', NULL, 'not_submitted', atlas_editor_id),
    (e_night_pending, night_orchid, 'submit', 'draft', 'draft', 'not_submitted', 'pending', atlas_editor_id),
    (e_night_approved_draft, night_orchid, 'approve', 'draft', 'draft', 'pending', 'approved', atlas_manager_id),
    (e_night_scheduled_future, night_orchid, 'schedule', 'draft', 'scheduled', 'approved', 'approved', atlas_manager_id),
    (e_night_public_upcoming, night_orchid, 'publish', 'draft', 'published', 'approved', 'approved', atlas_manager_id),
    (e_night_overnight, night_orchid, 'publish', 'draft', 'published', 'approved', 'approved', atlas_manager_id),
    (e_night_past, night_orchid, 'publish', 'draft', 'published', 'approved', 'approved', atlas_manager_id),
    (e_night_cancelled, night_orchid, 'cancel', 'published', 'cancelled', 'approved', 'approved', atlas_manager_id),
    (e_night_archived, night_orchid, 'archive', 'published', 'archived', 'approved', 'approved', atlas_manager_id),
    (e_night_quarantined, night_orchid, 'create', NULL, 'draft', NULL, 'not_submitted', atlas_staff_id),
    (e_night_en_only, night_orchid, 'publish', 'draft', 'published', 'approved', 'approved', atlas_manager_id),
    (e_night_copy_source, night_orchid, 'publish', 'draft', 'published', 'approved', 'approved', dual_staff_id),

    (e_harbor_public_upcoming, harbor_venue, 'publish', 'draft', 'published', 'approved', 'approved', harbor_owner_id),
    (e_restricted_public_upcoming, restricted_room, 'publish', 'draft', 'published', 'approved', 'approved', atlas_owner_id),
    (e_partial_disabled_public_upcoming, trial_partial, 'publish', 'draft', 'published', 'approved', 'approved', atlas_owner_id),
    (e_trial_expired_public_upcoming, trial_expired, 'publish', 'draft', 'published', 'approved', 'approved', atlas_owner_id),
    (e_draft_room_public_like, draft_room, 'publish', 'draft', 'published', 'approved', 'approved', atlas_owner_id);
END;
$$;

