# Tenant-isolation tests

Foundation isolation is asserted in SQL (pgTAP), not in this directory:

```bash
npm run db:test
```

Files: `supabase/tests/02_tenant_integrity.sql` (composite FKs reject mismatches) and `supabase/tests/03_rls_isolation.sql` (denied behaviour as `anon` and authenticated seed identities).

This directory stays empty of Vitest placeholders. The application-level suite required by [ADR-017](../../docs/decisions-and-open-questions.md#adr-017--vitest-playwright-and-mandatory-isolation-and-permission-suites) still belongs here once remaining tenant tables (feed, staff, bookings, …), storage, and public module paths exist. Authentication and `can()` coverage is in `tests/permissions/` and `tests/e2e/`.

Measure RLS-sensitive query paths with `npm run db:perf:seed` then `npm run db:perf` (OQ-30). Ordinary reset stays small. Baseline: [docs/performance/foundation-rls-baseline.md](../../docs/performance/foundation-rls-baseline.md).
