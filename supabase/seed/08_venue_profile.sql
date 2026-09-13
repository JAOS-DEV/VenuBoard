-- Fictional venue profile, contacts and hours. Reset-relative exceptions.
-- Coordinates are invented and must not be treated as a real customer venue.

DO $$
DECLARE
  v_now timestamptz := pg_catalog.now();
  harbor_owner_id uuid := '00000000-0000-4000-8000-000000000010';
  atlas_owner_id uuid := '00000000-0000-4000-8000-000000000020';
  harbor_venue uuid := '00000000-0000-4000-8000-000000000101';
  night_orchid uuid := '00000000-0000-4000-8000-000000000201';
  draft_room uuid := '00000000-0000-4000-8000-000000000202';
  trial_garden uuid := '00000000-0000-4000-8000-000000000205';
  v_local_today date := (v_now AT TIME ZONE 'Asia/Bangkok')::date;
  v_exc uuid := '00000000-0000-4000-8000-000000000e01';
  v_exc_open uuid := '00000000-0000-4000-8000-000000000e02';
BEGIN
  UPDATE public.venues
  SET
    latitude = 13.125,
    longitude = 100.875,
    province = 'Chonburi',
    postal_code = '20150',
    opening_hours_mode = 'scheduled'
  WHERE id = harbor_venue;

  UPDATE public.venues
  SET
    latitude = 7.875,
    longitude = 98.375,
    province = 'Phuket',
    postal_code = '83000',
    opening_hours_mode = 'scheduled'
  WHERE id = night_orchid;

  UPDATE public.venues
  SET opening_hours_mode = 'scheduled'
  WHERE id = draft_room;

  UPDATE public.venue_translations
  SET
    name = 'Harbor Light',
    directions = 'Fictional pier example. Walk toward the painted harbour lamp.'
  WHERE venue_id = harbor_venue AND locale = 'en';

  UPDATE public.venue_translations
  SET
    name = 'ฮาร์เบอร์ไลต์',
    directions = 'ท่าเรือสมมติ เดินไปทางโคมไฟท่าเรือ'
  WHERE venue_id = harbor_venue AND locale = 'th';

  UPDATE public.venue_translations
  SET name = 'Night Orchid'
  WHERE venue_id = night_orchid AND locale = 'en';

  UPDATE public.venue_translations
  SET name = 'ไนท์ออร์คิด'
  WHERE venue_id = night_orchid AND locale = 'th';

  INSERT INTO public.venue_contacts (
    id, venue_id, contact_type, value, is_public, sort_order, updated_by
  ) VALUES
    (
      '00000000-0000-4000-8000-000000000c01',
      harbor_venue,
      'email',
      'harbor.public@example.com',
      true,
      1,
      harbor_owner_id
    ),
    (
      '00000000-0000-4000-8000-000000000c02',
      harbor_venue,
      'phone',
      '+66 81 000 0101',
      true,
      2,
      harbor_owner_id
    ),
    (
      '00000000-0000-4000-8000-000000000c03',
      harbor_venue,
      'website',
      'https://harbor-light.example.com',
      true,
      3,
      harbor_owner_id
    ),
    (
      '00000000-0000-4000-8000-000000000c04',
      trial_garden,
      'email',
      'trial.garden@example.com',
      true,
      1,
      atlas_owner_id
    );

  INSERT INTO public.venue_closed_weekdays (venue_id, day_of_week)
  VALUES (harbor_venue, 7), (night_orchid, 1), (night_orchid, 2),
    (night_orchid, 3), (night_orchid, 7), (draft_room, 7);

  INSERT INTO public.venue_opening_hours (
    venue_id, day_of_week, sort_order, opens_local, closes_local, closes_next_day
  ) VALUES
    (harbor_venue, 1, 1, '10:00', '22:00', false),
    (harbor_venue, 2, 1, '11:00', '14:00', false),
    (harbor_venue, 2, 2, '17:00', '22:00', false),
    (harbor_venue, 3, 1, '10:00', '22:00', false),
    (harbor_venue, 4, 1, '10:00', '22:00', false),
    (harbor_venue, 5, 1, '10:00', '22:00', false),
    (harbor_venue, 6, 1, '10:00', '22:00', false),
    (night_orchid, 4, 1, '18:00', '02:00', true),
    (night_orchid, 5, 1, '18:00', '02:00', true),
    (night_orchid, 6, 1, '18:00', '02:00', true),
    (draft_room, 1, 1, '09:00', '17:00', false),
    (draft_room, 2, 1, '09:00', '17:00', false),
    (draft_room, 3, 1, '09:00', '17:00', false),
    (draft_room, 4, 1, '09:00', '17:00', false),
    (draft_room, 5, 1, '09:00', '17:00', false),
    (draft_room, 6, 1, '09:00', '17:00', false);

  INSERT INTO public.venue_hours_exceptions (
    id, venue_id, exception_date, is_closed, internal_note, updated_by
  ) VALUES
    (
      v_exc,
      harbor_venue,
      v_local_today + 1,
      true,
      'Private fixture note; never public',
      harbor_owner_id
    ),
    (
      v_exc_open,
      harbor_venue,
      v_local_today + 3,
      false,
      NULL,
      harbor_owner_id
    );

  INSERT INTO public.venue_hours_exception_intervals (
    exception_id, venue_id, sort_order, opens_local, closes_local, closes_next_day
  ) VALUES
    (v_exc_open, harbor_venue, 1, '12:00', '16:00', false);
END;
$$;
