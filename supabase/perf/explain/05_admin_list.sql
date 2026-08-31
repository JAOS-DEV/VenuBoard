EXPLAIN (ANALYZE, BUFFERS)
SELECT id, name, slug, publication_state
FROM public.venues
WHERE business_id = '21000000-0000-4000-8000-000000000001'
ORDER BY name;
