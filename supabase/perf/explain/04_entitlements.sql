EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM public.venue_module_entitlements
WHERE venue_id = '00000000-0000-4000-8000-000000000201'
  AND module_key = 'feed'
  AND revoked_at IS NULL;
