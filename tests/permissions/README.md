# Permissions tests

The 33-action catalogue and role mapping are asserted in SQL:

```bash
npm run db:test
```

Files: `supabase/tests/01_structure.sql` (exactly 33 keys, `moderate_content` held only by `platform_admin`) and `supabase/tests/04_permissions.sql` (helper results for each fixed seed identity).

This directory stays empty of Vitest placeholders. The application-level suite required by [ADR-017](../../docs/decisions-and-open-questions.md#adr-017--vitest-playwright-and-mandatory-isolation-and-permission-suites) still belongs here once `can(actor, action, scope)` exists. Those tests fail early for UX; they do not replace the SQL enforcement in `supabase/tests/` or [conditional-permission-enforcement.md](../../docs/security/conditional-permission-enforcement.md).
