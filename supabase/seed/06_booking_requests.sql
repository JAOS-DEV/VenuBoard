-- Deterministic fictional booking-enquiry seed. Reset-relative request times.
-- example.com contacts only. Not reservations.

DO $$
DECLARE
  v_now timestamptz := pg_catalog.now();
  v_request timestamptz := v_now + interval '7 days';

  harbor_owner_id uuid := '00000000-0000-4000-8000-000000000010';
  atlas_owner_id uuid := '00000000-0000-4000-8000-000000000020';
  atlas_manager_id uuid := '00000000-0000-4000-8000-000000000021';

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

  s_harbor uuid := '00000000-0000-7000-8000-000000000b01';
  s_night uuid := '00000000-0000-7000-8000-000000000b02';
  s_restricted uuid := '00000000-0000-7000-8000-000000000b03';
  s_silent uuid := '00000000-0000-7000-8000-000000000b04';
  s_garden uuid := '00000000-0000-7000-8000-000000000b05';
  s_partial uuid := '00000000-0000-7000-8000-000000000b06';
  s_expired uuid := '00000000-0000-7000-8000-000000000b07';
  s_draft uuid := '00000000-0000-7000-8000-000000000b08';

  e_harbor_new uuid := '00000000-0000-4000-8000-000000000601';
  e_harbor_review uuid := '00000000-0000-4000-8000-000000000602';
  e_harbor_handled uuid := '00000000-0000-4000-8000-000000000603';
  e_harbor_declined uuid := '00000000-0000-4000-8000-000000000604';
  e_night_new uuid := '00000000-0000-4000-8000-000000000605';
  e_night_spam uuid := '00000000-0000-4000-8000-000000000606';
  e_restricted uuid := '00000000-0000-4000-8000-000000000607';
  e_silent uuid := '00000000-0000-4000-8000-000000000608';
  e_draft uuid := '00000000-0000-4000-8000-000000000609';
  e_partial uuid := '00000000-0000-4000-8000-00000000060a';
  e_expired uuid := '00000000-0000-4000-8000-00000000060b';
  e_th uuid := '00000000-0000-4000-8000-00000000060c';
BEGIN
  UPDATE public.venue_module_entitlements
  SET ends_at = v_now + interval '30 days'
  WHERE venue_id = trial_garden
    AND module_key = 'booking_requests'
    AND grant_type = 'allow'
    AND revoked_at IS NULL;

  INSERT INTO public.venue_module_settings (
    id, venue_id, module_key, is_enabled, is_publicly_visible, display_order,
    settings, updated_by, created_at, updated_at
  )
  VALUES
    (s_harbor, harbor_venue, 'booking_requests',
      app_private.module_is_entitled(harbor_venue, 'booking_requests'),
      true, 8,
      '{"accepting_enquiries":true,"min_party_size":1,"max_party_size":12,"horizon_days":90,"lead_time_minutes":60,"instructions_en":"Send an enquiry. This does not confirm a booking.","instructions_th":"ส่งคำขอ ไม่ใช่การยืนยันการจอง"}'::jsonb,
      harbor_owner_id, v_now, v_now),
    (s_night, night_orchid, 'booking_requests',
      app_private.module_is_entitled(night_orchid, 'booking_requests'),
      true, 8,
      '{"accepting_enquiries":true,"min_party_size":1,"max_party_size":8,"horizon_days":60,"lead_time_minutes":120,"instructions_en":"Send an enquiry. This does not confirm a booking.","instructions_th":"ส่งคำขอ ไม่ใช่การยืนยันการจอง"}'::jsonb,
      atlas_owner_id, v_now, v_now),
    (s_restricted, restricted_room, 'booking_requests',
      app_private.module_is_entitled(restricted_room, 'booking_requests'),
      true, 8,
      '{"accepting_enquiries":true,"min_party_size":1,"max_party_size":10,"horizon_days":90,"lead_time_minutes":60,"instructions_en":"","instructions_th":""}'::jsonb,
      atlas_owner_id, v_now, v_now),
    (s_silent, silent_room, 'booking_requests',
      app_private.module_is_entitled(silent_room, 'booking_requests'),
      true, 8,
      '{"accepting_enquiries":true,"min_party_size":1,"max_party_size":10,"horizon_days":90,"lead_time_minutes":60,"instructions_en":"","instructions_th":""}'::jsonb,
      atlas_owner_id, v_now, v_now),
    (s_garden, trial_garden, 'booking_requests',
      app_private.module_is_entitled(trial_garden, 'booking_requests'),
      true, 8,
      '{"accepting_enquiries":false,"min_party_size":1,"max_party_size":10,"horizon_days":90,"lead_time_minutes":60,"instructions_en":"Enquiries are paused.","instructions_th":"หยุดรับคำขอชั่วคราว"}'::jsonb,
      atlas_owner_id, v_now, v_now),
    (s_partial, trial_partial, 'booking_requests', false, false, 8,
      '{"accepting_enquiries":false,"min_party_size":1,"max_party_size":10,"horizon_days":90,"lead_time_minutes":60,"instructions_en":"","instructions_th":""}'::jsonb,
      atlas_owner_id, v_now, v_now),
    (s_expired, trial_expired, 'booking_requests', false, false, 8,
      '{"accepting_enquiries":false,"min_party_size":1,"max_party_size":10,"horizon_days":90,"lead_time_minutes":60,"instructions_en":"","instructions_th":""}'::jsonb,
      atlas_owner_id, v_now, v_now),
    (s_draft, draft_room, 'booking_requests', false, false, 8,
      '{"accepting_enquiries":false,"min_party_size":1,"max_party_size":10,"horizon_days":90,"lead_time_minutes":60,"instructions_en":"","instructions_th":""}'::jsonb,
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
    ('00000000-0000-7000-8000-000000000c01', s_harbor, harbor_venue, 'en',
      'Enquire at Harbor Light', v_now, v_now, harbor_owner_id),
    ('00000000-0000-7000-8000-000000000c02', s_harbor, harbor_venue, 'th',
      'สอบถามฮาร์เบอร์ไลต์', v_now, v_now, harbor_owner_id),
    ('00000000-0000-7000-8000-000000000c03', s_night, night_orchid, 'en',
      'Enquire at Night Orchid', v_now, v_now, atlas_owner_id),
    ('00000000-0000-7000-8000-000000000c04', s_night, night_orchid, 'th',
      'สอบถามไนท์ออร์คิด', v_now, v_now, atlas_owner_id)
  ON CONFLICT (venue_module_setting_id, locale) DO UPDATE SET
    public_heading = EXCLUDED.public_heading,
    updated_by = EXCLUDED.updated_by,
    updated_at = EXCLUDED.updated_at;

  INSERT INTO public.booking_requests (
    id, venue_id, business_id, locale, party_size, requested_for, state,
    closure_outcome, reviewed_at, reviewed_by, closed_at, closed_by,
    created_at, updated_at
  )
  VALUES
    (e_harbor_new, harbor_venue, business_harbor, 'en', 2, v_request, 'new',
      NULL, NULL, NULL, NULL, NULL, v_now, v_now),
    (e_harbor_review, harbor_venue, business_harbor, 'en', 4, v_request, 'in_review',
      NULL, v_now, harbor_owner_id, NULL, NULL, v_now, v_now),
    (e_harbor_handled, harbor_venue, business_harbor, 'en', 3, v_request, 'closed',
      'handled', v_now, harbor_owner_id, v_now, harbor_owner_id, v_now, v_now),
    (e_harbor_declined, harbor_venue, business_harbor, 'en', 6, v_request, 'closed',
      'declined', v_now, harbor_owner_id, v_now, harbor_owner_id, v_now, v_now),
    (e_night_new, night_orchid, business_atlas, 'en', 2, v_request, 'new',
      NULL, NULL, NULL, NULL, NULL, v_now, v_now),
    (e_night_spam, night_orchid, business_atlas, 'en', 1, v_request, 'closed',
      'spam', v_now, atlas_manager_id, v_now, atlas_manager_id, v_now, v_now),
    (e_restricted, restricted_room, business_atlas, 'en', 2, v_request, 'new',
      NULL, NULL, NULL, NULL, NULL, v_now, v_now),
    (e_silent, silent_room, business_atlas, 'en', 2, v_request, 'new',
      NULL, NULL, NULL, NULL, NULL, v_now, v_now),
    (e_draft, draft_room, business_atlas, 'en', 2, v_request, 'new',
      NULL, NULL, NULL, NULL, NULL, v_now, v_now),
    (e_partial, trial_partial, business_atlas, 'en', 2, v_request, 'new',
      NULL, NULL, NULL, NULL, NULL, v_now, v_now),
    (e_expired, trial_expired, business_atlas, 'en', 2, v_request, 'new',
      NULL, NULL, NULL, NULL, NULL, v_now, v_now),
    (e_th, harbor_venue, business_harbor, 'th', 2, v_request, 'new',
      NULL, NULL, NULL, NULL, NULL, v_now, v_now)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.booking_request_contacts (
    booking_request_id, venue_id, customer_display_name, customer_email,
    customer_message, created_at
  )
  VALUES
    (e_harbor_new, harbor_venue, 'Alex Harbour', 'alex.harbour@example.com',
      'Window table if possible.', v_now),
    (e_harbor_review, harbor_venue, 'Blair Review', 'blair.review@example.com',
      'Celebrating a birthday.', v_now),
    (e_harbor_handled, harbor_venue, 'Casey Handled', 'casey.handled@example.com',
      NULL, v_now),
    (e_harbor_declined, harbor_venue, 'Drew Declined', 'drew.declined@example.com',
      'Large group.', v_now),
    (e_night_new, night_orchid, 'Nok Visitor', 'nok.visitor@example.com',
      'Quiet corner please.', v_now),
    (e_night_spam, night_orchid, 'Spam Bot', 'spam.bot@example.com',
      'Buy followers', v_now),
    (e_restricted, restricted_room, 'Restricted Guest', 'restricted.guest@example.com',
      NULL, v_now),
    (e_silent, silent_room, 'Silent Guest', 'silent.guest@example.com',
      'Should stay private.', v_now),
    (e_draft, draft_room, 'Draft Guest', 'draft.guest@example.com',
      'Unentitled leftover.', v_now),
    (e_partial, trial_partial, 'Partial Guest', 'partial.guest@example.com',
      'Not entitled leftover.', v_now),
    (e_expired, trial_expired, 'Expired Guest', 'expired.guest@example.com',
      'Expired leftover.', v_now),
    (e_th, harbor_venue, 'สมชาย ตัวอย่าง', 'somchai.example@example.com',
      'โต๊ะริมน้ำ', v_now)
  ON CONFLICT (booking_request_id) DO NOTHING;

  INSERT INTO public.booking_request_events (
    booking_request_id, venue_id, action, from_state, to_state,
    closure_outcome, actor_user_id, created_at
  )
  VALUES
    (e_harbor_new, harbor_venue, 'created', NULL, 'new', NULL, NULL, v_now),
    (e_harbor_review, harbor_venue, 'created', NULL, 'new', NULL, NULL, v_now),
    (e_harbor_review, harbor_venue, 'reviewed', 'new', 'in_review', NULL,
      harbor_owner_id, v_now),
    (e_harbor_handled, harbor_venue, 'created', NULL, 'new', NULL, NULL, v_now),
    (e_harbor_handled, harbor_venue, 'closed', 'new', 'closed', 'handled',
      harbor_owner_id, v_now),
    (e_harbor_declined, harbor_venue, 'created', NULL, 'new', NULL, NULL, v_now),
    (e_harbor_declined, harbor_venue, 'closed', 'new', 'closed', 'declined',
      harbor_owner_id, v_now),
    (e_night_new, night_orchid, 'created', NULL, 'new', NULL, NULL, v_now),
    (e_night_spam, night_orchid, 'created', NULL, 'new', NULL, NULL, v_now),
    (e_night_spam, night_orchid, 'closed', 'new', 'closed', 'spam',
      atlas_manager_id, v_now);
END;
$$;
