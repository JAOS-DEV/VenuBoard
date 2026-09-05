-- Feed module: schema, isolation, public visibility, workflow, authz, copy, grants.

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

CREATE FUNCTION pg_temp.feed_post_id(p_title text)
RETURNS uuid
LANGUAGE sql
AS $$
  SELECT t.post_id
  FROM public.feed_post_translations t
  WHERE t.locale = 'en' AND t.title = p_title
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION pg_temp.feed_post_id(text) TO anon, authenticated;

SELECT has_table('public', 'feed_posts', 'feed_posts exists');
SELECT has_table('public', 'feed_post_translations', 'feed_post_translations exists');
SELECT has_table('public', 'feed_post_events', 'feed_post_events exists');

SELECT ok(
  (SELECT relrowsecurity AND relforcerowsecurity
   FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'feed_posts'),
  'feed_posts forces RLS'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typtype = 'e'
      AND t.typname ILIKE '%feed%'
  ),
  0,
  'no feed PostgreSQL enums'
);

SELECT throws_ok(
  $$ INSERT INTO public.feed_posts (
       id, venue_id, business_id, post_type, state, created_by, updated_by
     ) VALUES (
       '00000000-0000-4000-8000-0000000005ff',
       '00000000-0000-4000-8000-000000000101',
       '00000000-0000-4000-8000-000000000200',
       'update', 'draft',
       '00000000-0000-4000-8000-000000000010',
       '00000000-0000-4000-8000-000000000010'
     ) $$,
  '23503',
  NULL,
  'composite tenant FK rejects mixed venue/business'
);

SELECT throws_ok(
  $$ INSERT INTO public.feed_posts (
       venue_id, business_id, post_type, state
     ) VALUES (
       '00000000-0000-4000-8000-000000000101',
       '00000000-0000-4000-8000-000000000100',
       'offer', 'draft'
     ) $$,
  '23514',
  NULL,
  'invalid post type is rejected'
);

SELECT throws_ok(
  $$ INSERT INTO public.feed_post_translations (
       post_id, venue_id, locale, title, body
     ) VALUES (
       '00000000-0000-4000-8000-000000000501',
       '00000000-0000-4000-8000-000000000101',
       'en', '', 'body'
     ) $$,
  '23514',
  NULL,
  'empty title is rejected'
);

SELECT throws_ok(
  $$ UPDATE public.feed_posts
     SET media_storage_path = 'https://evil.example/x.png'
     WHERE id = '00000000-0000-4000-8000-000000000501' $$,
  '23514',
  NULL,
  'remote media URL is rejected'
);

SELECT pg_temp.impersonate_anon();

SELECT throws_ok(
  $$ SELECT id FROM public.feed_posts $$,
  '42501',
  NULL,
  'anon cannot select feed_posts'
);

SELECT throws_ok(
  $$ SELECT title FROM public.feed_post_translations $$,
  '42501',
  NULL,
  'anon cannot select feed translations'
);

SELECT ok(
  ((list_public_venue_feed('harbor-light', 'en', 12, NULL))->>'available')::boolean,
  'public RPC is available for Harbor Light'
);

SELECT ok(
  (
    SELECT bool_and(
      item->>'title' IS NOT NULL
      AND item ? 'body'
      AND NOT (item ? 'id')
      AND NOT (item ? 'submitted_by')
      AND NOT (item ? 'approved_by')
    )
    FROM jsonb_array_elements(
      (list_public_venue_feed('harbor-light', 'en', 12, NULL))->'items'
    ) item
  ),
  'public items omit private identifiers'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM jsonb_array_elements(
      (list_public_venue_feed('night-orchid', 'en', 24, NULL))->'items'
    ) item
    WHERE item->>'title' IN (
      'Night Orchid Draft',
      'Pending guest DJ note',
      'Approved unpublished note',
      'Future closing notice',
      'Old archived update',
      'Rejected editable note',
      'Quarantined leftover'
    )
  ),
  0,
  'hidden workflow states are omitted from the public RPC'
);

SELECT ok(
  (
    SELECT bool_or(item->>'title' = 'Due scheduled update')
    FROM jsonb_array_elements(
      (list_public_venue_feed('night-orchid', 'en', 24, NULL))->'items'
    ) item
  ),
  'due scheduled post is visible at query time'
);

SELECT is(
  (list_public_venue_feed('silent-room', 'en', 12, NULL))->>'available',
  'false',
  'disabled module hides the public feed'
);

SELECT is(
  (list_public_venue_feed('trial-partial', 'en', 12, NULL))->>'available',
  'false',
  'disabled entitled venue hides the public feed'
);

SELECT is(
  (list_public_venue_feed('trial-expired', 'en', 12, NULL))->>'available',
  'false',
  'expired entitlement hides the public feed'
);

SELECT is(
  (list_public_venue_feed('draft-room', 'en', 12, NULL))->>'available',
  'false',
  'unpublished venue hides the public feed'
);

SELECT ok(
  ((list_public_venue_feed('restricted-room', 'en', 12, NULL))->>'available')::boolean,
  'restricted venue still exposes public posts'
);

SELECT is(
  (
    SELECT item->>'title'
    FROM jsonb_array_elements(
      (list_public_venue_feed('harbor-light', 'th', 12, NULL))->'items'
    ) item
    WHERE item->>'title' = 'English-only harbour note'
  ),
  'English-only harbour note',
  'Thai requests fall back to English when TH is missing'
);

SELECT ok(
  jsonb_array_length(
    (list_public_venue_feed('harbor-light', 'en', 100, NULL))->'items'
  ) <= 24,
  'public RPC clamps the page size'
);

SELECT is(
  jsonb_array_length(
    (list_public_venue_feed('harbor-light', 'en', 12, 'not-a-cursor'))->'items'
  ),
  0,
  'malformed cursors fail safely'
);

SELECT is(
  jsonb_array_length(
    (list_public_venue_feed('harbor-light', 'en', 12, NULL))->'items'
  ),
  12,
  'default public page size is 12'
);

SELECT ok(
  (list_public_venue_feed('harbor-light', 'en', 12, NULL))->>'next_cursor'
    IS NOT NULL,
  'Harbor public feed exposes a continuation cursor'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM jsonb_array_elements(
      (
        list_public_venue_feed(
          'harbor-light',
          'en',
          12,
          (list_public_venue_feed('harbor-light', 'en', 12, NULL))->>'next_cursor'
        )
      )->'items'
    ) item
    WHERE item->>'title' = 'Harbor extra eight'
  ),
  'page 2 via cursor includes the oldest Harbor extra'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000010');

SELECT isnt_empty(
  $$ SELECT id FROM public.feed_posts
     WHERE venue_id = '00000000-0000-4000-8000-000000000101' $$,
  'harbor owner can read own feed posts'
);

SELECT is(
  (SELECT count(*)::integer FROM public.feed_posts
   WHERE venue_id = '00000000-0000-4000-8000-000000000204'),
  0,
  'harbor owner cannot read Silent Room feed rows'
);

SELECT is(
  create_feed_post(
    '00000000-0000-4000-8000-000000000204',
    jsonb_build_object(
      'post_type', 'update',
      'title_en', 'Cross tenant',
      'body_en', 'Should be denied.'
    )
  )->>'code',
  'forbidden',
  'harbor owner cannot write Silent Room feed'
);

SELECT ok(
  (create_feed_post(
    '00000000-0000-4000-8000-000000000101',
    jsonb_build_object(
      'post_type', 'update',
      'title_en', 'Harbor extra draft',
      'body_en', 'Created in pgTAP and stays private.'
    )
  )->>'ok')::boolean,
  'harbor owner can create a draft'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000021');

SELECT is(
  create_feed_post(
    '00000000-0000-4000-8000-000000000101',
    jsonb_build_object(
      'post_type', 'update',
      'title_en', 'Foreign venue',
      'body_en', 'Denied.'
    )
  )->>'code',
  'forbidden',
  'venue manager cannot write a foreign venue'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000022');

SELECT is(
  publish_feed_post_now('00000000-0000-4000-8000-000000000507')->>'code',
  'forbidden',
  'C5: editor cannot publish when approval is required'
);

SELECT ok(
  (submit_feed_post_for_approval(
    '00000000-0000-4000-8000-000000000507'
  )->>'ok')::boolean,
  'C5: editor can submit a draft'
);

SELECT is(
  approve_feed_post('00000000-0000-4000-8000-000000000507')->>'code',
  'forbidden',
  'editor cannot approve their own post'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000021');

SELECT ok(
  (approve_feed_post('00000000-0000-4000-8000-000000000507')->>'ok')::boolean,
  'manager can approve an editor submission'
);

SELECT ok(
  (publish_feed_post_now('00000000-0000-4000-8000-000000000507')->>'ok')::boolean,
  'manager can publish an approved post'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000022');

SELECT ok(
  (create_feed_post(
    '00000000-0000-4000-8000-000000000201',
    jsonb_build_object(
      'post_type', 'update',
      'title_en', 'Stale approval unchanged',
      'body_en', 'Approved content that is not edited.'
    )
  )->>'ok')::boolean,
  'editor can create a post for unchanged-approval publish'
);

SELECT ok(
  (submit_feed_post_for_approval(
    pg_temp.feed_post_id('Stale approval unchanged')
  )->>'ok')::boolean,
  'editor submits the unchanged-approval post'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000021');

SELECT ok(
  (approve_feed_post(pg_temp.feed_post_id('Stale approval unchanged'))->>'ok')::boolean,
  'manager approves the unchanged post'
);

SELECT ok(
  (publish_feed_post_now(pg_temp.feed_post_id('Stale approval unchanged'))->>'ok')::boolean,
  'an unchanged approved post can publish'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000022');

SELECT ok(
  (create_feed_post(
    '00000000-0000-4000-8000-000000000201',
    jsonb_build_object(
      'post_type', 'update',
      'title_en', 'Stale approval EN',
      'body_en', 'Original English body.',
      'title_th', 'ต้นฉบับ',
      'body_th', 'เนื้อหาภาษาไทยเดิม'
    )
  )->>'ok')::boolean,
  'editor can create a bilingual post for EN edit'
);

SELECT ok(
  (submit_feed_post_for_approval(pg_temp.feed_post_id('Stale approval EN'))->>'ok')::boolean,
  'editor submits the EN-edit post'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000021');

SELECT ok(
  (approve_feed_post(pg_temp.feed_post_id('Stale approval EN'))->>'ok')::boolean,
  'manager approves the EN-edit post'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000022');

SELECT ok(
  (update_feed_post_draft(
    pg_temp.feed_post_id('Stale approval EN'),
    jsonb_build_object(
      'post_type', 'update',
      'title_en', 'Stale approval EN changed',
      'body_en', 'Edited English body.',
      'title_th', 'ต้นฉบับ',
      'body_th', 'เนื้อหาภาษาไทยเดิม'
    )
  )->>'ok')::boolean,
  'editor can edit English after approval'
);

SELECT is(
  (
    SELECT approved_at
    FROM public.feed_posts
    WHERE id = pg_temp.feed_post_id('Stale approval EN changed')
  ),
  NULL,
  'editing EN clears approval'
);

SELECT is(
  publish_feed_post_now(pg_temp.feed_post_id('Stale approval EN changed'))->>'code',
  'forbidden',
  'editor cannot publish an edited approved post'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000021');

SELECT is(
  publish_feed_post_now(pg_temp.feed_post_id('Stale approval EN changed'))->>'code',
  'forbidden',
  'an edited approved post cannot publish'
);

SELECT is(
  schedule_feed_post_publication(
    pg_temp.feed_post_id('Stale approval EN changed'),
    pg_catalog.now() + interval '2 days'
  )->>'code',
  'forbidden',
  'an edited approved post cannot schedule'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000022');

SELECT ok(
  (submit_feed_post_for_approval(
    pg_temp.feed_post_id('Stale approval EN changed')
  )->>'ok')::boolean,
  'editor resubmits the changed post'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000021');

SELECT ok(
  (approve_feed_post(pg_temp.feed_post_id('Stale approval EN changed'))->>'ok')::boolean,
  'a manager must approve the changed version again'
);

SELECT ok(
  (publish_feed_post_now(pg_temp.feed_post_id('Stale approval EN changed'))->>'ok')::boolean,
  'after reapproval, publication succeeds'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000022');

SELECT ok(
  (create_feed_post(
    '00000000-0000-4000-8000-000000000201',
    jsonb_build_object(
      'post_type', 'update',
      'title_en', 'Stale approval TH',
      'body_en', 'English stays the same.',
      'title_th', 'ไทยเดิม',
      'body_th', 'เนื้อหาไทยเดิม'
    )
  )->>'ok')::boolean,
  'editor can create a post for TH edit'
);

SELECT ok(
  (submit_feed_post_for_approval(pg_temp.feed_post_id('Stale approval TH'))->>'ok')::boolean,
  'editor submits the TH-edit post'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000021');

SELECT ok(
  (approve_feed_post(pg_temp.feed_post_id('Stale approval TH'))->>'ok')::boolean,
  'manager approves the TH-edit post'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000022');

SELECT ok(
  (update_feed_post_draft(
    pg_temp.feed_post_id('Stale approval TH'),
    jsonb_build_object(
      'post_type', 'update',
      'title_en', 'Stale approval TH',
      'body_en', 'English stays the same.',
      'title_th', 'ไทยใหม่',
      'body_th', 'เนื้อหาไทยใหม่'
    )
  )->>'ok')::boolean,
  'editor can edit Thai after approval'
);

SELECT is(
  (
    SELECT approved_at
    FROM public.feed_posts
    WHERE id = pg_temp.feed_post_id('Stale approval TH')
  ),
  NULL,
  'editing TH clears approval'
);

SELECT ok(
  (update_feed_post_draft(
    pg_temp.feed_post_id('Stale approval TH'),
    jsonb_build_object(
      'post_type', 'update',
      'title_en', 'Stale approval TH',
      'body_en', 'English stays the same.'
    )
  )->>'ok')::boolean,
  'editor can remove the Thai translation after approval'
);

SELECT is(
  (
    SELECT approved_at
    FROM public.feed_posts
    WHERE id = pg_temp.feed_post_id('Stale approval TH')
  ),
  NULL,
  'removing a translation keeps approval cleared'
);

SELECT ok(
  (create_feed_post(
    '00000000-0000-4000-8000-000000000201',
    jsonb_build_object(
      'post_type', 'update',
      'title_en', 'Stale approval type',
      'body_en', 'Type will change after approval.'
    )
  )->>'ok')::boolean,
  'editor can create a post for type change'
);

SELECT ok(
  (submit_feed_post_for_approval(pg_temp.feed_post_id('Stale approval type'))->>'ok')::boolean,
  'editor submits the type-change post'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000021');

SELECT ok(
  (approve_feed_post(pg_temp.feed_post_id('Stale approval type'))->>'ok')::boolean,
  'manager approves the type-change post'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000022');

SELECT ok(
  (update_feed_post_draft(
    pg_temp.feed_post_id('Stale approval type'),
    jsonb_build_object(
      'post_type', 'notice',
      'title_en', 'Stale approval type',
      'body_en', 'Type will change after approval.'
    )
  )->>'ok')::boolean,
  'editor can change post type after approval'
);

SELECT is(
  (
    SELECT approved_at
    FROM public.feed_posts
    WHERE id = pg_temp.feed_post_id('Stale approval type')
  ),
  NULL,
  'changing post type clears approval'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000022');

SELECT ok(
  (create_feed_post(
    '00000000-0000-4000-8000-000000000201',
    jsonb_build_object(
      'post_type', 'update',
      'title_en', 'Stale approval add TH',
      'body_en', 'English only until Thai is added.'
    )
  )->>'ok')::boolean,
  'editor can create an EN-only post to add a translation'
);

SELECT ok(
  (submit_feed_post_for_approval(
    pg_temp.feed_post_id('Stale approval add TH')
  )->>'ok')::boolean,
  'editor submits the add-TH post'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000021');

SELECT ok(
  (approve_feed_post(pg_temp.feed_post_id('Stale approval add TH'))->>'ok')::boolean,
  'manager approves the add-TH post'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000022');

SELECT ok(
  (update_feed_post_draft(
    pg_temp.feed_post_id('Stale approval add TH'),
    jsonb_build_object(
      'post_type', 'update',
      'title_en', 'Stale approval add TH',
      'body_en', 'English only until Thai is added.',
      'title_th', 'เพิ่มไทย',
      'body_th', 'เพิ่มคำแปลหลังอนุมัติ'
    )
  )->>'ok')::boolean,
  'editor can add a Thai translation after approval'
);

SELECT is(
  (
    SELECT approved_at
    FROM public.feed_posts
    WHERE id = pg_temp.feed_post_id('Stale approval add TH')
  ),
  NULL,
  'adding a translation after approval clears approval'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000022');

SELECT ok(
  (create_feed_post(
    '00000000-0000-4000-8000-000000000201',
    jsonb_build_object(
      'post_type', 'update',
      'title_en', 'Stale approval manager edit',
      'body_en', 'Manager will edit after approval.'
    )
  )->>'ok')::boolean,
  'editor can create a post for manager edit'
);

SELECT ok(
  (submit_feed_post_for_approval(
    pg_temp.feed_post_id('Stale approval manager edit')
  )->>'ok')::boolean,
  'editor submits the manager-edit post'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000021');

SELECT ok(
  (approve_feed_post(
    pg_temp.feed_post_id('Stale approval manager edit')
  )->>'ok')::boolean,
  'manager approves the manager-edit post'
);

SELECT ok(
  (update_feed_post_draft(
    pg_temp.feed_post_id('Stale approval manager edit'),
    jsonb_build_object(
      'post_type', 'update',
      'title_en', 'Stale approval manager edit',
      'body_en', 'Manager changed the body.'
    )
  )->>'ok')::boolean,
  'manager can edit after approval'
);

SELECT is(
  (
    SELECT approved_at
    FROM public.feed_posts
    WHERE id = pg_temp.feed_post_id('Stale approval manager edit')
  ),
  NULL,
  'manager edit after approval clears approval'
);

SELECT is(
  publish_feed_post_now(
    pg_temp.feed_post_id('Stale approval manager edit')
  )->>'code',
  'forbidden',
  'manager cannot publish their own unapproved edit'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000022');

SELECT ok(
  (create_feed_post(
    '00000000-0000-4000-8000-000000000201',
    jsonb_build_object(
      'post_type', 'update',
      'title_en', 'Stale approval restore',
      'body_en', 'Will be archived and restored.'
    )
  )->>'ok')::boolean,
  'editor can create a post for restore'
);

SELECT ok(
  (submit_feed_post_for_approval(pg_temp.feed_post_id('Stale approval restore'))->>'ok')::boolean,
  'editor submits the restore post'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000021');

SELECT ok(
  (approve_feed_post(pg_temp.feed_post_id('Stale approval restore'))->>'ok')::boolean,
  'manager approves the restore post'
);

SELECT ok(
  (publish_feed_post_now(pg_temp.feed_post_id('Stale approval restore'))->>'ok')::boolean,
  'manager publishes the restore post'
);

SELECT ok(
  (archive_feed_post(pg_temp.feed_post_id('Stale approval restore'))->>'ok')::boolean,
  'manager archives the restore post'
);

SELECT ok(
  (restore_feed_post_to_draft(pg_temp.feed_post_id('Stale approval restore'))->>'ok')::boolean,
  'manager restores the archived post'
);

SELECT is(
  (
    SELECT approved_at
    FROM public.feed_posts
    WHERE id = pg_temp.feed_post_id('Stale approval restore')
  ),
  NULL,
  'restoring an archived post clears approval'
);

SELECT is(
  publish_feed_post_now(pg_temp.feed_post_id('Stale approval restore'))->>'code',
  'forbidden',
  'a restored post cannot publish on a stale approval'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000022');

SELECT ok(
  (create_feed_post(
    '00000000-0000-4000-8000-000000000201',
    jsonb_build_object(
      'post_type', 'update',
      'title_en', 'Stale approval unpublish',
      'body_en', 'Will be unpublished then edited.'
    )
  )->>'ok')::boolean,
  'editor can create a post for unpublish then edit'
);

SELECT ok(
  (submit_feed_post_for_approval(
    pg_temp.feed_post_id('Stale approval unpublish')
  )->>'ok')::boolean,
  'editor submits the unpublish post'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000021');

SELECT ok(
  (approve_feed_post(pg_temp.feed_post_id('Stale approval unpublish'))->>'ok')::boolean,
  'manager approves the unpublish post'
);

SELECT ok(
  (publish_feed_post_now(pg_temp.feed_post_id('Stale approval unpublish'))->>'ok')::boolean,
  'manager publishes the unpublish post'
);

SELECT ok(
  (unpublish_feed_post(pg_temp.feed_post_id('Stale approval unpublish'))->>'ok')::boolean,
  'manager unpublishes the post'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000022');

SELECT ok(
  (update_feed_post_draft(
    pg_temp.feed_post_id('Stale approval unpublish'),
    jsonb_build_object(
      'post_type', 'update',
      'title_en', 'Stale approval unpublish',
      'body_en', 'Edited after unpublish.'
    )
  )->>'ok')::boolean,
  'editor can edit after unpublish'
);

SELECT is(
  (
    SELECT approved_at
    FROM public.feed_posts
    WHERE id = pg_temp.feed_post_id('Stale approval unpublish')
  ),
  NULL,
  'editing after unpublish clears approval'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000021');

SELECT is(
  publish_feed_post_now(pg_temp.feed_post_id('Stale approval unpublish'))->>'code',
  'forbidden',
  'unpublish then edit cannot republish on the old approval'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000022');

SELECT ok(
  (create_feed_post(
    '00000000-0000-4000-8000-000000000201',
    jsonb_build_object(
      'post_type', 'update',
      'title_en', 'Stale approval setting',
      'body_en', 'Approved before the setting is toggled.'
    )
  )->>'ok')::boolean,
  'editor can create a post for approval-setting toggle'
);

SELECT ok(
  (submit_feed_post_for_approval(
    pg_temp.feed_post_id('Stale approval setting')
  )->>'ok')::boolean,
  'editor submits the setting-toggle post'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000021');

SELECT ok(
  (approve_feed_post(pg_temp.feed_post_id('Stale approval setting'))->>'ok')::boolean,
  'manager approves before the setting is toggled'
);

SELECT pg_temp.as_postgres();
UPDATE public.venue_module_settings
SET settings = jsonb_set(settings, '{require_manager_approval}', 'false'::jsonb)
WHERE venue_id = '00000000-0000-4000-8000-000000000201'
  AND module_key = 'feed';

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000022');

SELECT ok(
  (update_feed_post_draft(
    pg_temp.feed_post_id('Stale approval setting'),
    jsonb_build_object(
      'post_type', 'update',
      'title_en', 'Stale approval setting',
      'body_en', 'Edited while approval was disabled.'
    )
  )->>'ok')::boolean,
  'editor can edit after approval while the setting is off'
);

SELECT pg_temp.as_postgres();
UPDATE public.venue_module_settings
SET settings = jsonb_set(settings, '{require_manager_approval}', 'true'::jsonb)
WHERE venue_id = '00000000-0000-4000-8000-000000000201'
  AND module_key = 'feed';

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000021');

SELECT is(
  publish_feed_post_now(pg_temp.feed_post_id('Stale approval setting'))->>'code',
  'forbidden',
  'enabling approval after an earlier approval cannot publish edited content'
);

SELECT pg_temp.as_postgres();
UPDATE public.venue_module_settings
SET settings = jsonb_set(settings, '{require_manager_approval}', 'false'::jsonb)
WHERE venue_id = '00000000-0000-4000-8000-000000000201'
  AND module_key = 'feed';

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000022');

SELECT ok(
  (create_feed_post(
    '00000000-0000-4000-8000-000000000201',
    jsonb_build_object(
      'post_type', 'update',
      'title_en', 'Editor direct publish',
      'body_en', 'Allowed only while approval is off.'
    )
  )->>'ok')::boolean,
  'editor can create a draft when approval is off'
);

SELECT ok(
  (
    SELECT (publish_feed_post_now(id)->>'ok')::boolean
    FROM public.feed_posts
    WHERE venue_id = '00000000-0000-4000-8000-000000000201'
      AND state = 'draft'
      AND created_by = '00000000-0000-4000-8000-000000000022'
    ORDER BY created_at DESC
    LIMIT 1
  ),
  'C5: editor may publish when approval is disabled'
);

SELECT pg_temp.as_postgres();
UPDATE public.venue_module_settings
SET settings = jsonb_set(settings, '{require_manager_approval}', 'true'::jsonb)
WHERE venue_id = '00000000-0000-4000-8000-000000000201'
  AND module_key = 'feed';

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000024');

SELECT ok(
  (create_feed_post(
    '00000000-0000-4000-8000-000000000201',
    jsonb_build_object(
      'post_type', 'update',
      'title_en', 'Staff draft',
      'body_en', 'C4 allows staff drafts only.'
    )
  )->>'ok')::boolean,
  'C4: staff may create a feed draft'
);

SELECT is(
  (
    SELECT (publish_feed_post_now(id)->>'code')
    FROM public.feed_posts
    WHERE venue_id = '00000000-0000-4000-8000-000000000201'
      AND created_by = '00000000-0000-4000-8000-000000000024'
    ORDER BY created_at DESC
    LIMIT 1
  ),
  'forbidden',
  'C4: staff cannot publish a feed post'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000026');

SELECT is(
  create_feed_post(
    '00000000-0000-4000-8000-000000000201',
    jsonb_build_object(
      'post_type', 'update',
      'title_en', 'Deactivated',
      'body_en', 'Denied.'
    )
  )->>'code',
  'forbidden',
  'deactivated actor is denied'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000020');

SELECT is(
  create_feed_post(
    '00000000-0000-4000-8000-000000000203',
    jsonb_build_object(
      'post_type', 'update',
      'title_en', 'Restricted write',
      'body_en', 'Denied by C16.'
    )
  )->>'code',
  'forbidden',
  'C16: restricted venue blocks feed writes'
);

SELECT is(
  create_feed_post(
    '00000000-0000-4000-8000-000000000209',
    jsonb_build_object(
      'post_type', 'update',
      'title_en', 'Expired write',
      'body_en', 'Denied by C17.'
    )
  )->>'code',
  'forbidden',
  'C17: expired entitlement blocks feed writes'
);

SELECT ok(
  (copy_feed_post_to_venue(
    '00000000-0000-4000-8000-00000000050f',
    '00000000-0000-4000-8000-000000000205'
  )->>'ok')::boolean,
  'C18: same-business copy is allowed'
);

SELECT is(
  (
    SELECT state
    FROM public.feed_posts
    WHERE source_post_id = '00000000-0000-4000-8000-00000000050f'
      AND venue_id = '00000000-0000-4000-8000-000000000205'
  ),
  'draft',
  'copied post starts as a private draft'
);

SELECT is(
  (
    SELECT is_pinned OR media_storage_path IS NOT NULL OR published_at IS NOT NULL
    FROM public.feed_posts
    WHERE source_post_id = '00000000-0000-4000-8000-00000000050f'
      AND venue_id = '00000000-0000-4000-8000-000000000205'
  ),
  false,
  'copy resets pin, media and publication state'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000010');

SELECT is(
  copy_feed_post_to_venue(
    '00000000-0000-4000-8000-00000000050f',
    '00000000-0000-4000-8000-000000000101'
  )->>'code',
  'forbidden',
  'cross-business copy is denied'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000001');

SELECT is(
  (SELECT count(*)::integer FROM public.feed_posts),
  0,
  'platform role alone cannot read feed tables'
);

SELECT is(
  create_feed_post(
    '00000000-0000-4000-8000-000000000101',
    jsonb_build_object(
      'post_type', 'update',
      'title_en', 'Platform write',
      'body_en', 'Denied without a support session.'
    )
  )->>'code',
  'forbidden',
  'C19: platform role alone cannot write feed posts'
);

SELECT pg_temp.impersonate('00000000-0000-4000-8000-000000000010');

SELECT ok(
  (pin_feed_post('00000000-0000-4000-8000-000000000504')->>'ok') IS DISTINCT FROM 'true',
  'pinning a fourth Harbor post is rejected'
);

SELECT ok(
  (unpublish_feed_post('00000000-0000-4000-8000-000000000504')->>'ok')::boolean,
  'owner can unpublish a public post'
);

SELECT pg_temp.impersonate_anon();

SELECT is(
  (
    SELECT count(*)::integer
    FROM jsonb_array_elements(
      (list_public_venue_feed('harbor-light', 'en', 24, NULL))->'items'
    ) item
    WHERE item->>'title' = 'New mocktail list'
  ),
  0,
  'unpublish hides the post immediately'
);

SELECT pg_temp.as_postgres();

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM public.audit_log
    WHERE target_table = 'feed_posts'
      AND (
        metadata::text ILIKE '%@%'
        OR coalesce(previous_state::text, '') ILIKE '%kitchen%'
        OR coalesce(resulting_state::text, '') ILIKE '%mocktail%'
        OR coalesce(summary, '') ILIKE '%The kitchen%'
      )
  ),
  'feed audit rows contain no post body or email'
);

SELECT ok(
  (
    SELECT every(
      prosecdef AND EXISTS (
        SELECT 1
        FROM unnest(coalesce(p.proconfig, ARRAY[]::text[])) AS cfg
        WHERE cfg IN ('search_path=', 'search_path=""')
      )
    )
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname IN ('public', 'app_private')
      AND p.proname IN (
        'create_feed_post',
        'list_public_venue_feed',
        'may_publish_feed_post',
        'copy_feed_post_to_venue',
        'write_feed_audit'
      )
      AND p.prosecdef
  ),
  'feed definer functions fix search_path to empty'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'create_feed_post',
        'update_feed_post_draft',
        'submit_feed_post_for_approval',
        'approve_feed_post',
        'reject_feed_post',
        'publish_feed_post_now',
        'schedule_feed_post_publication',
        'unpublish_feed_post',
        'pin_feed_post',
        'unpin_feed_post',
        'archive_feed_post',
        'restore_feed_post_to_draft',
        'copy_feed_post_to_venue',
        'update_feed_module_settings',
        'list_public_venue_feed'
      )
    GROUP BY p.proname
    HAVING count(*) > 1
  ),
  'feed public RPCs have no overloads'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    CROSS JOIN LATERAL aclexplode(
      COALESCE(p.proacl, acldefault('f', p.proowner))
    ) AS a
    WHERE n.nspname = 'app_private'
      AND (
        p.proname LIKE '%feed%'
        OR p.proname IN (
          'may_read_feed_admin',
          'may_create_feed_post',
          'may_publish_feed_post'
        )
      )
      AND a.grantee = 0
      AND a.privilege_type = 'EXECUTE'
  ),
  'PUBLIC cannot execute feed private helpers'
);

SELECT pg_temp.impersonate_anon();

SELECT ok(
  (SELECT has_function_privilege(
     'anon',
     'public.list_public_venue_feed(text, text, integer, text)',
     'EXECUTE'
   )),
  'anon can execute the public feed RPC'
);

SELECT throws_ok(
  $$ SELECT create_feed_post(
       '00000000-0000-4000-8000-000000000101'::uuid,
       '{}'::jsonb
     ) $$,
  '42501',
  NULL,
  'anon cannot execute feed write RPCs'
);

SELECT pg_temp.as_postgres();

SELECT throws_ok(
  $$ INSERT INTO public.venue_module_settings (
       venue_id, module_key, is_enabled, is_publicly_visible, display_order,
       settings, updated_by
     ) VALUES (
       '00000000-0000-4000-8000-000000000201',
       'feed',
       true, true, 9,
       '{"css":"body{}","require_manager_approval":false}'::jsonb,
       '00000000-0000-4000-8000-000000000020'
     ) $$,
  '23514',
  NULL,
  'feed settings reject css injection'
);

SELECT * FROM finish();

ROLLBACK;
