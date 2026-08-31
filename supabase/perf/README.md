# Local RLS performance fixture

Not loaded by `npm run db:reset`. Ordinary demonstration seed stays small.

```bash
VENUBOARD_ENV=local npm run db:perf:seed   # refused in production and staging; local Docker only
VENUBOARD_ENV=local npm run db:perf        # EXPLAIN (ANALYZE, BUFFERS); not a production claim
```

SQL for the five measured paths lives in `supabase/perf/explain/`.

- Fictional `example.com` rows only
- Idempotent: a second seed run only `ANALYZE`s
- Restore a clean database with `npm run db:reset`
- Not used in GitHub Actions
