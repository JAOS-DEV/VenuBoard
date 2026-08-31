EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM public.venue_memberships
WHERE user_id = '00000000-0000-4000-8000-000000000021'
  AND status = 'active'
  AND deactivated_at IS NULL;
