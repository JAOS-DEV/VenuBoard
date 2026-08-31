-- Local-only performance fixture. Not loaded by db:reset.
-- Reserved example.com identities only. Idempotent: skips if already present.
--
-- Targets (plus the ordinary demonstration seed):
--   100 businesses, 1_000 venues, 100 business memberships,
--   5_000 venue memberships, 10_000 entitlements,
--   1_000 subscriptions, 1_200 translations.

DO $$
DECLARE
  epoch timestamptz := timestamptz '2026-08-01 00:00:00+00';
  admin_id uuid := '00000000-0000-4000-8000-000000000001';
  atlas_owner_id uuid := '00000000-0000-4000-8000-000000000020';
  manager_id uuid := '00000000-0000-4000-8000-000000000021';
  editor_id uuid := '00000000-0000-4000-8000-000000000022';
  booking_id uuid := '00000000-0000-4000-8000-000000000023';
  staff_id uuid := '00000000-0000-4000-8000-000000000024';
  dual_staff_id uuid := '00000000-0000-4000-8000-000000000027';
  plan_core uuid := '10000000-0000-4000-8000-000000000001';
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.businesses WHERE slug = 'perf-biz-001'
  ) THEN
    RAISE NOTICE 'performance fixture already present; running ANALYZE only';
    ANALYZE public.businesses;
    ANALYZE public.venues;
    ANALYZE public.venue_translations;
    ANALYZE public.business_memberships;
    ANALYZE public.venue_memberships;
    ANALYZE public.venue_module_entitlements;
    ANALYZE public.subscriptions;
  ELSE
  INSERT INTO public.businesses (
    id, name, legal_name, slug, country, default_locale, contact_email,
    status, created_at, updated_at
  )
  SELECT
    ('21000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
    'Perf Business ' || lpad(n::text, 3, '0'),
    'Perf Business ' || lpad(n::text, 3, '0') || ' Ltd',
    'perf-biz-' || lpad(n::text, 3, '0'),
    'TH',
    'en',
    'perf.biz.' || lpad(n::text, 3, '0') || '@example.com',
    'active',
    epoch,
    epoch
  FROM generate_series(1, 100) AS n;

  INSERT INTO public.business_memberships (
    business_id, user_id, role, status, invited_by, accepted_at, created_at, updated_at
  )
  SELECT
    ('21000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
    atlas_owner_id,
    'business_owner',
    'active',
    admin_id,
    epoch,
    epoch,
    epoch
  FROM generate_series(1, 100) AS n;

  INSERT INTO public.venues (
    id, business_id, name, slug, timezone, default_locale, city, country,
    content_classification, publication_state, status, created_at, updated_at
  )
  SELECT
    ('22000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
    ('21000000-0000-4000-8000-' || lpad((((n - 1) / 10) + 1)::text, 12, '0'))::uuid,
    'Perf Venue ' || lpad(n::text, 4, '0'),
    'perf-venue-' || lpad(n::text, 4, '0'),
    'Asia/Bangkok',
    'en',
    'Phuket',
    'TH',
    'general',
    'published',
    'active',
    epoch,
    epoch
  FROM generate_series(1, 1000) AS n;

  INSERT INTO public.venue_translations (
    venue_id, locale, description, tagline, created_at, updated_at
  )
  SELECT
    v.id,
    'en',
    'Fictional performance-fixture venue.',
    'Perf ' || v.slug,
    epoch,
    epoch
  FROM public.venues v
  WHERE v.slug LIKE 'perf-venue-%';

  INSERT INTO public.venue_translations (
    venue_id, locale, description, tagline, created_at, updated_at
  )
  SELECT
    v.id,
    'th',
    'สถานที่สมมติสำหรับวัดแผนคิวรี',
    'เพอร์ฟ ' || v.slug,
    epoch,
    epoch
  FROM public.venues v
  WHERE v.slug LIKE 'perf-venue-%'
    AND right(v.slug, 1) IN ('0', '1');

  INSERT INTO public.subscriptions (
    id, venue_id, plan_id, state, current_period_start, current_period_end,
    managed_manually, created_at, updated_at
  )
  SELECT
    ('23000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
    ('22000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
    plan_core,
    'active',
    epoch,
    epoch + interval '30 days',
    true,
    epoch,
    epoch
  FROM generate_series(1, 1000) AS n;

  INSERT INTO public.venue_memberships (
    venue_id, user_id, role, status, invited_by, accepted_at, created_at, updated_at
  )
  SELECT
    v.id,
    u.user_id,
    u.role,
    'active',
    atlas_owner_id,
    epoch,
    epoch,
    epoch
  FROM public.venues v
  CROSS JOIN (
    VALUES
      (manager_id, 'venue_manager'::text),
      (editor_id, 'content_editor'),
      (booking_id, 'booking_manager'),
      (staff_id, 'staff'),
      (dual_staff_id, 'staff')
  ) AS u(user_id, role)
  WHERE v.slug LIKE 'perf-venue-%';

  INSERT INTO public.venue_module_entitlements (
    venue_id, module_key, source_key, grant_type, starts_at, granted_by, reason, created_at
  )
  SELECT
    v.id,
    m.key,
    'plan',
    'allow',
    epoch,
    admin_id,
    'Performance fixture plan',
    epoch
  FROM public.venues v
  CROSS JOIN public.modules m
  WHERE v.slug LIKE 'perf-venue-%';

  INSERT INTO public.venue_module_entitlements (
    venue_id, module_key, source_key, grant_type, starts_at, ends_at,
    granted_by, reason, created_at
  )
  SELECT
    v.id,
    extra.module_key,
    'trial',
    'allow',
    epoch,
    epoch + interval '30 days',
    admin_id,
    'Performance fixture extra trial row',
    epoch
  FROM public.venues v
  CROSS JOIN (
    VALUES ('feed'::text), ('events'::text)
  ) AS extra(module_key)
  WHERE v.slug LIKE 'perf-venue-%';

  INSERT INTO public.venue_storage_usage (
    venue_id, quota_bytes, used_bytes, last_recalculated_at, updated_at
  )
  SELECT v.id, 1073741824, 2048, epoch, epoch
  FROM public.venues v
  WHERE v.slug LIKE 'perf-venue-%';

  ANALYZE public.businesses;
  ANALYZE public.venues;
  ANALYZE public.venue_translations;
  ANALYZE public.business_memberships;
  ANALYZE public.venue_memberships;
  ANALYZE public.venue_module_entitlements;
  ANALYZE public.subscriptions;
  ANALYZE public.venue_storage_usage;
  END IF;
END;
$$;
