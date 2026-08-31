EXPLAIN (ANALYZE, BUFFERS)
SELECT v.id, v.slug, v.name, t.locale, t.tagline, t.description
FROM public.venues v
LEFT JOIN public.venue_translations t
  ON t.venue_id = v.id AND t.locale = 'en'
WHERE v.slug = 'harbor-light'
  AND v.publication_state = 'published'
  AND v.platform_quarantined_at IS NULL
  AND v.archived_at IS NULL
  AND v.status = 'active';
