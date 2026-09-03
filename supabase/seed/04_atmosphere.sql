-- Deterministic fictional atmosphere seed.
-- No real customers. Timestamps are relative to reset time.

DO $$
DECLARE
  v_now timestamptz := pg_catalog.now();

  harbor_owner_id uuid := '00000000-0000-4000-8000-000000000010';
  atlas_owner_id uuid := '00000000-0000-4000-8000-000000000020';

  harbor_venue uuid := '00000000-0000-4000-8000-000000000101';
  night_orchid uuid := '00000000-0000-4000-8000-000000000201';
  draft_room uuid := '00000000-0000-4000-8000-000000000202';
  restricted_room uuid := '00000000-0000-4000-8000-000000000203';
  silent_room uuid := '00000000-0000-4000-8000-000000000204';
  trial_partial uuid := '00000000-0000-4000-8000-000000000206';
  trial_expired uuid := '00000000-0000-4000-8000-000000000209';

  s_harbor uuid := '00000000-0000-6000-8000-000000000901';
  s_night uuid := '00000000-0000-6000-8000-000000000902';
  s_draft uuid := '00000000-0000-6000-8000-000000000903';
  s_restricted uuid := '00000000-0000-6000-8000-000000000904';
  s_silent uuid := '00000000-0000-6000-8000-000000000905';
  s_partial uuid := '00000000-0000-6000-8000-000000000906';
  s_expired uuid := '00000000-0000-6000-8000-000000000907';

  a_harbor uuid := '00000000-0000-6000-8000-000000000a01';
  a_night uuid := '00000000-0000-6000-8000-000000000a02';
  a_silent uuid := '00000000-0000-6000-8000-000000000a03';
  a_restricted uuid := '00000000-0000-6000-8000-000000000a04';
  a_expired uuid := '00000000-0000-6000-8000-000000000a05';
  a_draft uuid := '00000000-0000-6000-8000-000000000a06';
BEGIN
  INSERT INTO public.venue_module_settings (
    id, venue_id, module_key, is_enabled, is_publicly_visible, display_order,
    settings, updated_by, created_at, updated_at
  )
  VALUES
    (s_harbor, harbor_venue, 'atmosphere', true, true, 3,
      '{"default_expiry_minutes":120,"front_of_house_may_update":false,"presentation":"card"}'::jsonb,
      harbor_owner_id, v_now, v_now),
    (s_night, night_orchid, 'atmosphere', true, true, 3,
      '{"default_expiry_minutes":120,"front_of_house_may_update":true,"presentation":"card"}'::jsonb,
      atlas_owner_id, v_now, v_now),
    (s_draft, draft_room, 'atmosphere', false, false, 3,
      '{"default_expiry_minutes":120,"front_of_house_may_update":false,"presentation":"compact"}'::jsonb,
      atlas_owner_id, v_now, v_now),
    (s_restricted, restricted_room, 'atmosphere', true, true, 3,
      '{"default_expiry_minutes":120,"front_of_house_may_update":false,"presentation":"card"}'::jsonb,
      atlas_owner_id, v_now, v_now),
    (s_silent, silent_room, 'atmosphere', false, true, 3,
      '{"default_expiry_minutes":120,"front_of_house_may_update":false,"presentation":"card"}'::jsonb,
      atlas_owner_id, v_now, v_now),
    (s_partial, trial_partial, 'atmosphere', false, true, 3,
      '{"default_expiry_minutes":120,"front_of_house_may_update":false,"presentation":"card"}'::jsonb,
      atlas_owner_id, v_now, v_now),
    (s_expired, trial_expired, 'atmosphere', false, false, 3,
      '{"default_expiry_minutes":120,"front_of_house_may_update":false,"presentation":"card"}'::jsonb,
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
    ('00000000-0000-6000-8000-000000000910', s_harbor, harbor_venue, 'en',
      'Right now at Harbor Light', v_now, v_now, harbor_owner_id),
    ('00000000-0000-6000-8000-000000000911', s_harbor, harbor_venue, 'th',
      'ตอนนี้ที่ฮาร์เบอร์ไลต์', v_now, v_now, harbor_owner_id),
    ('00000000-0000-6000-8000-000000000912', s_night, night_orchid, 'en',
      'The room feels', v_now, v_now, atlas_owner_id),
    ('00000000-0000-6000-8000-000000000913', s_night, night_orchid, 'th',
      'บรรยากาศตอนนี้', v_now, v_now, atlas_owner_id)
  ON CONFLICT (venue_module_setting_id, locale) DO UPDATE SET
    public_heading = EXCLUDED.public_heading,
    updated_by = EXCLUDED.updated_by,
    updated_at = EXCLUDED.updated_at;

  INSERT INTO public.venue_atmosphere (
    id, venue_id, business_id, atmosphere_state, set_at, expires_at, changed_by,
    created_at, updated_at
  )
  VALUES
    (a_harbor, harbor_venue, '00000000-0000-4000-8000-000000000100',
      'lively', v_now - interval '20 minutes', v_now + interval '100 minutes',
      harbor_owner_id, v_now, v_now),
    (a_night, night_orchid, '00000000-0000-4000-8000-000000000200',
      'social', v_now - interval '10 minutes', v_now + interval '110 minutes',
      atlas_owner_id, v_now, v_now),
    (a_silent, silent_room, '00000000-0000-4000-8000-000000000200',
      'lively', v_now - interval '5 minutes', v_now + interval '115 minutes',
      atlas_owner_id, v_now, v_now),
    (a_restricted, restricted_room, '00000000-0000-4000-8000-000000000200',
      'calm', v_now - interval '15 minutes', v_now + interval '105 minutes',
      atlas_owner_id, v_now, v_now),
    (a_expired, trial_expired, '00000000-0000-4000-8000-000000000200',
      'high_energy', v_now - interval '3 hours', v_now - interval '1 hour',
      atlas_owner_id, v_now - interval '3 hours', v_now - interval '3 hours'),
    (a_draft, draft_room, '00000000-0000-4000-8000-000000000200',
      'social', v_now - interval '5 minutes', v_now + interval '115 minutes',
      atlas_owner_id, v_now, v_now)
  ON CONFLICT (venue_id) DO UPDATE SET
    atmosphere_state = EXCLUDED.atmosphere_state,
    set_at = EXCLUDED.set_at,
    expires_at = EXCLUDED.expires_at,
    changed_by = EXCLUDED.changed_by,
    updated_at = EXCLUDED.updated_at;

  INSERT INTO public.venue_atmosphere_events (
    venue_id, business_id, previous_state, new_state, action, source,
    expiry_minutes, expires_at, actor_user_id, environment, changed_at
  )
  VALUES
    (harbor_venue, '00000000-0000-4000-8000-000000000100', NULL, 'lively', 'set', 'rpc',
      120, v_now + interval '100 minutes', harbor_owner_id, 'local', v_now - interval '20 minutes'),
    (night_orchid, '00000000-0000-4000-8000-000000000200', NULL, 'social', 'set', 'rpc',
      120, v_now + interval '110 minutes', atlas_owner_id, 'local', v_now - interval '10 minutes');
END;
$$;
