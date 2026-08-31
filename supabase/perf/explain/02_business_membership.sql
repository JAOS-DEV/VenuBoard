EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM public.business_memberships
WHERE user_id = '00000000-0000-4000-8000-000000000010'
  AND status = 'active'
  AND deactivated_at IS NULL;
