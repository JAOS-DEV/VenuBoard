-- Offers module: schema, isolation, public gates, workflow, C5/C16/C17, grants.

BEGIN;

SELECT no_plan();

CREATE FUNCTION pg_temp.impersonate(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', p_user_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user_id::text, 'role', 'authenticated')::text,
    true
  );
END;
$$;

CREATE FUNCTION pg_temp.impersonate_anon()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('role', 'anon', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', 'anon', true);
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
END;
$$;

CREATE FUNCTION pg_temp.as_postgres()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
END;
$$;

GRANT EXECUTE ON FUNCTION pg_temp.impersonate(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION pg_temp.impersonate_anon() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION pg_temp.as_postgres() TO anon, authenticated;

CREATE FUNCTION pg_temp.offer_id(p_title text)
RETURNS uuid
LANGUAGE sql
AS $$
  SELECT t.offer_id
  FROM public.offer_translations t
  WHERE t.locale = 'en' AND t.title = p_title
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION pg_temp.offer_id(text) TO anon, authenticated;

CREATE FUNCTION pg_temp.harbor_local(p_delta interval)
RETURNS text
LANGUAGE sql
AS $$
  SELECT to_char(
    (pg_catalog.now() + p_delta) AT TIME ZONE 'Asia/Bangkok',
    'YYYY-MM-DD"T"HH24:MI'
  );
$$;

GRANT EXECUTE ON FUNCTION pg_temp.harbor_local(interval) TO anon, authenticated;

SELECT pg_temp.as_postgres();

UPDATE public.venue_module_entitlements e
SET ends_at = now() + interval '30 days'
FROM public.venues v
WHERE e.venue_id = v.id
  AND v.slug = 'trial-garden'
  AND e.module_key = 'offers'
  AND e.grant_type = 'allow'
  AND e.revoked_at IS NULL;

INSERT INTO public.venue_module_settings (
  venue_id, module_key, is_enabled, is_publicly_visible, settings, updated_by
)
SELECT
  v.id,
  'offers',
  true,
  true,
  CASE
    WHEN v.slug = 'trial-garden' THEN
      '{"require_manager_approval":true,"homepage_preview_enabled":true,"homepage_preview_count":2}'::jsonb
    ELSE
      '{"require_manager_approval":false,"homepage_preview_enabled":true,"homepage_preview_count":3}'::jsonb
  END,
  '00000000-0000-4000-8000-000000000010'
FROM public.venues v
WHERE v.slug IN (
  'harbor-light', 'trial-garden', 'restricted-room'
)
  AND app_private.module_is_entitled(v.id, 'offers')
ON CONFLICT (venue_id, module_key) DO UPDATE SET
  is_enabled = EXCLUDED.is_enabled,
  is_publicly_visible = EXCLUDED.is_publicly_visible,
  settings = EXCLUDED.settings;

INSERT INTO public.offers (
  id, venue_id, business_id, state, valid_from, valid_until,
  scheduled_for, published_at, submitted_by, approved_by, approved_at,
  archived_at, platform_quarantined_at, created_by, updated_by
)
SELECT
  x.id, v.id, v.business_id, x.state, x.valid_from, x.valid_until,
  x.scheduled_for, x.published_at, x.submitted_by, x.approved_by, x.approved_at,
  x.archived_at, x.quarantined_at, x.actor, x.actor
FROM public.venues v
JOIN (
  VALUES
    (
      '00000000-0000-4000-8000-000000000e01'::uuid,
      'harbor-light',
      'published',
      now() - interval '2 days',
      now() + interval '14 days',
      NULL::timestamptz,
      now() - interval '2 days',
      NULL::uuid,
      NULL::uuid,
      NULL::timestamptz,
      NULL::timestamptz,
      NULL::timestamptz,
      '00000000-0000-4000-8000-000000000010'::uuid
    ),
    (
      '00000000-0000-4000-8000-000000000e02',
      'harbor-light',
      'published',
      now() + interval '7 days',
      now() + interval '21 days',
      NULL,
      now() - interval '1 day',
      NULL, NULL, NULL, NULL, NULL,
      '00000000-0000-4000-8000-000000000010'
    ),
    (
      '00000000-0000-4000-8000-000000000e03',
      'harbor-light',
      'published',
      now() - interval '21 days',
      now() - interval '1 day',
      NULL,
      now() - interval '20 days',
      NULL, NULL, NULL, NULL, NULL,
      '00000000-0000-4000-8000-000000000010'
    ),
    (
      '00000000-0000-4000-8000-000000000e04',
      'harbor-light',
      'draft',
      now() + interval '1 day',
      now() + interval '10 days',
      NULL, NULL, NULL, NULL, NULL, NULL, NULL,
      '00000000-0000-4000-8000-000000000010'
    ),
    (
      '00000000-0000-4000-8000-000000000e05',
      'harbor-light',
      'scheduled',
      now() - interval '1 day',
      now() + interval '12 days',
      now() + interval '2 days',
      NULL, NULL, NULL, NULL, NULL, NULL,
      '00000000-0000-4000-8000-000000000010'
    ),
    (
      '00000000-0000-4000-8000-000000000e06',
      'harbor-light',
      'draft',
      now() - interval '1 day',
      now() + interval '8 days',
      NULL, NULL, NULL, NULL, NULL, NULL,
      now() - interval '30 minutes',
      '00000000-0000-4000-8000-000000000010'
    ),
    (
      '00000000-0000-4000-8000-000000000e07',
      'harbor-light',
      'published',
      now() - interval '1 day',
      now() + interval '9 days',
      NULL,
      now() - interval '1 day',
      NULL, NULL, NULL, NULL, NULL,
      '00000000-0000-4000-8000-000000000010'
    ),
    (
      '00000000-0000-4000-8000-000000000e08',
      'trial-garden',
      'pending_approval',
      now() - interval '1 day',
      now() + interval '10 days',
      NULL, NULL,
      '00000000-0000-4000-8000-000000000022',
      NULL, NULL, NULL, NULL,
      '00000000-0000-4000-8000-000000000022'
    ),
    (
      '00000000-0000-4000-8000-000000000e09',
      'trial-garden',
      'draft',
      now() - interval '1 day',
      now() + interval '11 days',
      NULL, NULL,
      '00000000-0000-4000-8000-000000000022',
      '00000000-0000-4000-8000-000000000021',
      now() - interval '10 minutes',
      NULL, NULL,
      '00000000-0000-4000-8000-000000000022'
    ),
    (
      '00000000-0000-4000-8000-000000000e0a',
      'trial-garden',
      'published',
      now() - interval '1 day',
      now() + interval '13 days',
      NULL,
      now() - interval '12 hours',
      NULL, NULL, NULL, NULL, NULL,
      '00000000-0000-4000-8000-000000000020'
    ),
    (
      '00000000-0000-4000-8000-000000000e0b',
      'restricted-room',
      'published',
      now() - interval '1 day',
      now() + interval '7 days',
      NULL,
      now() - interval '1 day',
      NULL, NULL, NULL, NULL, NULL,
      '00000000-0000-4000-8000-000000000020'
    )
) AS x(
  id, slug, state, valid_from, valid_until, scheduled_for, published_at,
  submitted_by, approved_by, approved_at, archived_at, quarantined_at, actor
) ON v.slug = x.slug
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.offer_translations (
  offer_id, venue_id, locale, title, description, terms, updated_by
)
SELECT x.offer_id, o.venue_id, x.locale, x.title, x.description, x.terms, o.created_by
FROM public.offers o
JOIN (
  VALUES
    ('00000000-0000-4000-8000-000000000e01'::uuid, 'en', 'Weekday lunch set',
     'A fictional two-course lunch.', 'Informational only.', 'en'),
    ('00000000-0000-4000-8000-000000000e01', 'th', 'ชุดอาหารกลางวันวันธรรมดา',
     'ชุดอาหารกลางวันสมมติ', 'ข้อมูลเท่านั้น', 'th'),
    ('00000000-0000-4000-8000-000000000e02', 'en', 'Weekend tasting preview',
     'Starts next week.', 'Not yet valid.', 'en'),
    ('00000000-0000-4000-8000-000000000e03', 'en', 'Last month garden plate',
     'Already ended.', 'This promotion has ended.', 'en'),
    ('00000000-0000-4000-8000-000000000e04', 'en', 'Draft harbour snack',
     'Private draft.', 'Draft terms stay private.', 'en'),
    ('00000000-0000-4000-8000-000000000e05', 'en', 'Scheduled harbour dessert',
     'Waiting for publication time.', 'Not public yet.', 'en'),
    ('00000000-0000-4000-8000-000000000e06', 'en', 'Quarantined harbour notice',
     'Quarantined copy.', 'Not public.', 'en'),
    ('00000000-0000-4000-8000-000000000e07', 'en', 'English-only harbour salad',
     'Thai copy is absent.', 'Informational only.', 'en'),
    ('00000000-0000-4000-8000-000000000e08', 'en', 'Pending garden pastry',
     'Awaiting approval.', 'Private until approved.', 'en'),
    ('00000000-0000-4000-8000-000000000e09', 'en', 'Approved garden soup',
     'Approved current content.', 'Still a private draft.', 'en'),
    ('00000000-0000-4000-8000-000000000e0a', 'en', 'Garden fruit plate',
     'A fictional fruit plate.', 'Informational only.', 'en'),
    ('00000000-0000-4000-8000-000000000e0b', 'en', 'Restricted room snack',
     'Leftover public copy.', 'Informational only.', 'en')
) AS x(offer_id, locale, title, description, terms, loc)
  ON o.id = x.offer_id
ON CONFLICT (offer_id, locale) DO NOTHING;

INSERT INTO public.venue_memberships (
  id, venue_id, user_id, role, status, invited_by, accepted_at
)
SELECT
  '00000000-0000-4000-8000-000000000e31',
  v.id,
  '00000000-0000-4000-8000-000000000021',
  'venue_manager',
  'active',
  '00000000-0000-4000-8000-000000000020',
  now()
FROM public.venues v
WHERE v.slug = 'trial-garden'
  AND NOT EXISTS (
    SELECT 1
    FROM public.venue_memberships m
    WHERE m.venue_id = v.id
      AND m.user_id = '00000000-0000-4000-8000-000000000021'
      AND m.status = 'active'
  );

INSERT INTO public.venue_memberships (
  id, venue_id, user_id, role, status, invited_by, accepted_at
)
SELECT
  '00000000-0000-4000-8000-000000000e30',
  v.id,
  '00000000-0000-4000-8000-000000000022',
  'content_editor',
  'active',
  '00000000-0000-4000-8000-000000000020',
  now()
FROM public.venues v
WHERE v.slug = 'trial-garden'
  AND NOT EXISTS (
    SELECT 1
    FROM public.venue_memberships m
    WHERE m.venue_id = v.id
      AND m.user_id = '00000000-0000-4000-8000-000000000022'
      AND m.status = 'active'
  );

SELECT has_table('public', 'offers', 'offers exists');
SELECT has_table('public', 'offer_translations', 'offer_translations exists');
SELECT has_table('public', 'offer_events', 'offer_events exists');

SELECT ok(
  (SELECT relrowsecurity AND relforcerowsecurity
   FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'offers'),
  'offers forces RLS'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typtype = 'e'
      AND t.typname ILIKE '%offer%'
  ),
  0,
  'no offer PostgreSQL enums'
);

SELECT throws_ok(
  $$ INSERT INTO public.offers (
       id, venue_id, business_id, state, valid_from, valid_until,
       created_by, updated_by
     ) VALUES (
       '00000000-0000-4000-8000-000000000dff',
       '00000000-0000-4000-8000-000000000101',
       '00000000-0000-4000-8000-000000000200',
       'draft',
       now(), now() + interval '1 day',
       '00000000-0000-4000-8000-000000000010',
       '00000000-0000-4000-8000-000000000010'
     ) $$,
  '23503',
  NULL,
  'composite tenant FK rejects mixed venue/business'
);

SELECT throws_ok(
  $$ INSERT INTO public.offers (
       venue_id, business_id, valid_from, valid_until, created_by, updated_by
     )
     SELECT '00000000-0000-4000-8000-000000000101',
            '00000000-0000-4000-8000-000000000100',
            now(), now(),
            '00000000-0000-4000-8000-000000000010',
            '00000000-0000-4000-8000-000000000010' $$,
  '23514',
  NULL,
  'valid_until must be after valid_from'
);

SELECT throws_ok(
  $$ INSERT INTO public.offer_translations (
       offer_id, venue_id, locale, title, description, terms
     )
     SELECT offer_id, venue_id, locale, title || ' x', description, terms
     FROM public.offer_translations
     WHERE locale = 'en'
     LIMIT 1 $$,
  '23505',
  NULL,
  'translation uniqueness (offer_id, locale)'
);

SELECT pg_temp.impersonate_anon();

SELECT throws_ok(
  $$ SELECT id FROM public.offers $$,
  '42501',
  NULL,
  'anon cannot select offers'
);

SELECT throws_ok(
  $$ SELECT title FROM public.offer_translations $$,
  '42501',
  NULL,
  'anon cannot select offer translations'
);

SELECT ok(
  (
    SELECT bool_and(item->>'title' = 'Weekday lunch set')
    FROM jsonb_array_elements(
      public.list_public_venue_offers('harbor-light', 'en', 24, NULL)->'items'
    ) AS item
    WHERE item->>'title' = 'Weekday lunch set'
  ),
  'active harbor offer is public'
);

SELECT ok(
  NOT (
    SELECT COALESCE(jsonb_agg(item->>'title'), '[]'::jsonb)::text
      LIKE '%Weekend tasting preview%'
    FROM jsonb_array_elements(
      public.list_public_venue_offers('harbor-light', 'en', 24, NULL)->'items'
    ) AS item
  ),
  'future-valid published offer is hidden'
);

SELECT ok(
  NOT (
    SELECT COALESCE(jsonb_agg(item->>'title'), '[]'::jsonb)::text
      LIKE '%Last month garden plate%'
    FROM jsonb_array_elements(
      public.list_public_venue_offers('harbor-light', 'en', 24, NULL)->'items'
    ) AS item
  ),
  'expired offer is hidden'
);

SELECT ok(
  NOT (
    SELECT COALESCE(jsonb_agg(item->>'title'), '[]'::jsonb)::text
      LIKE '%Draft harbour snack%'
    FROM jsonb_array_elements(
      public.list_public_venue_offers('harbor-light', 'en', 24, NULL)->'items'
    ) AS item
  ),
  'draft offer is hidden'
);

SELECT ok(
  NOT (
    SELECT COALESCE(jsonb_agg(item->>'title'), '[]'::jsonb)::text
      LIKE '%Scheduled harbour dessert%'
    FROM jsonb_array_elements(
      public.list_public_venue_offers('harbor-light', 'en', 24, NULL)->'items'
    ) AS item
  ),
  'future-scheduled offer is hidden'
);

SELECT ok(
  NOT (
    SELECT COALESCE(jsonb_agg(item->>'title'), '[]'::jsonb)::text
      LIKE '%Quarantined harbour notice%'
    FROM jsonb_array_elements(
      public.list_public_venue_offers('harbor-light', 'en', 24, NULL)->'items'
    ) AS item
  ),
  'quarantined offer is hidden'
);

SELECT is(
  (public.list_public_venue_offers('night-orchid', 'en', 24, NULL)->>'available')::boolean,
  false,
  'C17: night-orchid offers remain unavailable'
);

SELECT is(
  (public.list_public_venue_offers('silent-room', 'en', 24, NULL)->>'available')::boolean,
  false,
  'suspended venue hides offers'
);

SELECT is(
  (public.list_public_venue_offers('draft-room', 'en', 24, NULL)->>'available')::boolean,
  false,
  'unpublished venue hides offers'
);

SELECT ok(
  (
    SELECT COALESCE(jsonb_agg(item->>'title'), '[]'::jsonb)::text
      LIKE '%Restricted room snack%'
    FROM jsonb_array_elements(
      public.list_public_venue_offers('restricted-room', 'en', 24, NULL)->'items'
    ) AS item
  ),
  'C16 restricted venue may still show public offers'
);

SELECT is(
  (
    SELECT item->>'title'
    FROM jsonb_array_elements(
      public.list_public_venue_offers('harbor-light', 'th', 24, NULL)->'items'
    ) AS item
    WHERE item->>'title' IN ('English-only harbour salad', 'ชุดอาหารกลางวันวันธรรมดา')
    ORDER BY item->>'title'
    LIMIT 1
  ),
  'English-only harbour salad',
  'Thai page falls back to English when TH is absent'
);

SELECT ok(
  (
    SELECT bool_and(
      item ? 'title'
      AND item ? 'description'
      AND item ? 'terms'
      AND item ? 'valid_from'
      AND NOT (item ? 'id')
      AND NOT (item ? 'approved_at')
      AND NOT (item ? 'created_by')
    )
    FROM jsonb_array_elements(
      public.list_public_venue_offers('harbor-light', 'en', 24, NULL)->'items'
    ) AS item
  ),
  'public payload omits private identifiers'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000010');

SELECT is(
  (public.create_offer(
    '00000000-0000-4000-8000-000000000101',
    jsonb_build_object(
      'title_en', 'Owner lunch special',
      'description_en', 'Fictional owner-created lunch copy.',
      'terms_en', 'Informational only.',
      'valid_from_local', pg_temp.harbor_local(interval '1 hour'),
      'valid_until_local', pg_temp.harbor_local(interval '5 days')
    )
  )->>'ok')::boolean,
  true,
  'harbor owner can create an offer'
);

SELECT is(
  (public.publish_offer_now(pg_temp.offer_id('Owner lunch special'))->>'ok')::boolean,
  true,
  'harbor owner can publish without approval'
);

SELECT is(
  public.create_offer(
    '00000000-0000-4000-8000-000000000101',
    jsonb_build_object(
      'title_en', 'Bad media',
      'description_en', 'Should reject remote paths.',
      'terms_en', 'Informational only.',
      'valid_from_local', pg_temp.harbor_local(interval '1 hour'),
      'valid_until_local', pg_temp.harbor_local(interval '2 days'),
      'media_storage_path', 'https://example.com/x.png'
    )
  )->>'code',
  'invalid_payload',
  'remote media URLs are rejected'
);

SELECT is(
  (SELECT count(*)::integer FROM public.offers
   WHERE venue_id = '00000000-0000-4000-8000-000000000201'),
  0,
  'harbor owner cannot read night-orchid offers'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000022');

SELECT is(
  public.publish_offer_now(pg_temp.offer_id('Approved garden soup'))->>'code',
  'forbidden',
  'C5: editor cannot publish at trial-garden when approval is required'
);

SELECT is(
  public.approve_offer(pg_temp.offer_id('Pending garden pastry'))->>'code',
  'forbidden',
  'editor cannot self-approve'
);

SELECT is(
  (public.update_offer_draft(
    pg_temp.offer_id('Approved garden soup'),
    jsonb_build_object(
      'title_en', 'Approved garden soup edited',
      'description_en', 'Edited after approval.',
      'terms_en', 'Informational only.',
      'valid_from_local', pg_temp.harbor_local(interval '1 hour'),
      'valid_until_local', pg_temp.harbor_local(interval '6 days')
    )
  )->>'ok')::boolean,
  true,
  'material edit of an approved draft succeeds'
);

SELECT is(
  (SELECT approved_at IS NULL FROM public.offers
   WHERE id = pg_temp.offer_id('Approved garden soup edited')),
  true,
  'stale approval is cleared after a material edit'
);

SELECT is(
  public.publish_offer_now(pg_temp.offer_id('Approved garden soup edited'))->>'code',
  'forbidden',
  'changed content cannot publish on old approval'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000021');

SELECT is(
  (public.approve_offer(pg_temp.offer_id('Pending garden pastry'))->>'ok')::boolean,
  true,
  'manager can approve an editor submission'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000023');

SELECT is(
  (SELECT count(*)::integer FROM public.offers),
  0,
  'booking manager cannot read offers'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000024');

SELECT is(
  (SELECT count(*)::integer FROM public.offers),
  0,
  'staff cannot read offers'
);

SELECT is(
  public.create_offer(
    '00000000-0000-4000-8000-000000000205',
    jsonb_build_object(
      'title_en', 'Staff must not author offers',
      'description_en', 'Staff have no offer grants.',
      'terms_en', 'Informational only.',
      'valid_from_local', pg_temp.harbor_local(interval '1 hour'),
      'valid_until_local', pg_temp.harbor_local(interval '2 days')
    )
  )->>'code',
  'forbidden',
  'staff cannot create offers'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000020');

SELECT is(
  public.create_offer(
    '00000000-0000-4000-8000-000000000203',
    jsonb_build_object(
      'title_en', 'Restricted write',
      'description_en', 'Should be blocked.',
      'terms_en', 'Informational only.',
      'valid_from_local', pg_temp.harbor_local(interval '1 hour'),
      'valid_until_local', pg_temp.harbor_local(interval '2 days')
    )
  )->>'code',
  'forbidden',
  'C16 restricted venue blocks offer writes'
);

SELECT is(
  (public.archive_offer(pg_temp.offer_id('Garden fruit plate'))->>'ok')::boolean,
  true,
  'owner can archive a published offer'
);

SELECT is(
  (public.restore_offer_to_draft(pg_temp.offer_id('Garden fruit plate'))->>'ok')::boolean,
  true,
  'restore returns to draft'
);

SELECT is(
  (
    SELECT state = 'draft' AND approved_at IS NULL AND scheduled_for IS NULL
      AND published_at IS NULL
    FROM public.offers
    WHERE id = pg_temp.offer_id('Garden fruit plate')
  ),
  true,
  'restore clears approval, schedule and publication'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000001');

SELECT is(
  public.create_offer(
    '00000000-0000-4000-8000-000000000101',
    jsonb_build_object(
      'title_en', 'Platform should not author',
      'description_en', 'Support session required.',
      'terms_en', 'Informational only.',
      'valid_from_local', pg_temp.harbor_local(interval '1 hour'),
      'valid_until_local', pg_temp.harbor_local(interval '2 days')
    )
  )->>'code',
  'forbidden',
  'C19: platform admin without support write cannot create tenant offers'
);

SELECT pg_temp.as_postgres();

SELECT ok(
  (
    SELECT prosecdef AND proconfig::text LIKE '%search_path=%'
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'create_offer'
  ),
  'create_offer is SECURITY DEFINER with search_path'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'create_offer',
        'update_offer_draft',
        'publish_offer_now',
        'list_public_venue_offers'
      )
      AND pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
      AND p.proname <> 'list_public_venue_offers'
  ),
  0,
  'anon cannot execute private offer write RPCs'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'create_offer'
  ),
  1,
  'create_offer has no unsafe overload'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM public.audit_log
    WHERE target_table = 'offers'
      AND (
        resulting_state::text ILIKE '%Weekday lunch%'
        OR resulting_state::text ILIKE '%Informational only%'
        OR summary ILIKE '%two-course%'
      )
  ),
  'offer audit payloads omit titles, descriptions and terms'
);

SELECT finish();

ROLLBACK;
