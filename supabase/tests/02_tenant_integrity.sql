-- Tenant-key integrity (ADR-037). Run as table owner so RLS is not the thing
-- rejecting the row — the constraint must be.

BEGIN;

SELECT no_plan();

SELECT throws_ok(
  $$ INSERT INTO public.venues (
       business_id, name, slug, timezone, default_locale, publication_state, status
     ) VALUES (
       '00000000-0000-4000-8000-000000000099',
       'Orphan',
       'orphan-venue',
       'Asia/Bangkok',
       'en',
       'draft',
       'active'
     ) $$,
  '23503',
  NULL,
  'venue cannot reference a missing business'
);

SELECT throws_ok(
  $$ INSERT INTO public.venue_module_setting_translations (
       venue_module_setting_id,
       venue_id,
       locale,
       public_heading
     ) VALUES (
       '00000000-0000-4000-8000-000000000905',
       '00000000-0000-4000-8000-000000000201',
       'en',
       'cross-venue mismatch'
     ) $$,
  '23503',
  NULL,
  'setting translation cannot claim a different venue from its parent'
);

SELECT throws_ok(
  $$ INSERT INTO public.venue_billing_records (
       venue_id,
       subscription_id,
       period_start,
       period_end,
       description,
       state
     ) VALUES (
       '00000000-0000-4000-8000-000000000201',
       '00000000-0000-4000-8000-000000000801',
       timestamptz '2026-08-01 00:00:00+00',
       timestamptz '2026-08-31 00:00:00+00',
       'mismatched billing parent',
       'draft'
     ) $$,
  '23503',
  NULL,
  'billing record cannot use another venue''s subscription'
);

SELECT throws_ok(
  $$ INSERT INTO public.trial_extensions (
       venue_id,
       subscription_id,
       extended_by,
       previous_trial_ends_at,
       new_trial_ends_at,
       reason
     ) VALUES (
       '00000000-0000-4000-8000-000000000101',
       '00000000-0000-4000-8000-000000000808',
       '00000000-0000-4000-8000-000000000001',
       timestamptz '2026-08-01 00:00:00+00',
       timestamptz '2026-09-01 00:00:00+00',
       'mismatched trial parent'
     ) $$,
  '23503',
  NULL,
  'trial extension cannot use another venue''s subscription'
);

SELECT throws_ok(
  $$ INSERT INTO public.invitations (
       email, scope_type, business_id, venue_id, role, token_hash,
       invited_by, expires_at, state
     ) VALUES (
       'mix@example.com',
       'venue',
       '00000000-0000-4000-8000-000000000100',
       '00000000-0000-4000-8000-000000000201',
       'staff',
       'hash-scope-xor',
       '00000000-0000-4000-8000-000000000020',
       now() + interval '1 day',
       'pending'
     ) $$,
  '23514',
  NULL,
  'invitation cannot set both business_id and venue_id'
);

SELECT lives_ok(
  $$ INSERT INTO public.venue_translations (venue_id, locale, tagline)
     VALUES ('00000000-0000-4000-8000-000000000202', 'th', 'ฉบับร่าง') $$,
  'matching parent venue_id is accepted'
);

SELECT throws_ok(
  $$ INSERT INTO public.venue_memberships (
       venue_id, user_id, role, status
     ) VALUES (
       '00000000-0000-4000-8000-000000000101',
       '00000000-0000-4000-8000-000000000021',
       'platform_admin',
       'active'
     ) $$,
  '23514',
  NULL,
  'venue membership cannot hold a platform role'
);

SELECT * FROM finish();

ROLLBACK;
