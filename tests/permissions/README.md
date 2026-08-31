# Permissions tests

The 33-action catalogue and role mapping are asserted in SQL and in Vitest:

```bash
npm run db:test
npm run test:ci
```

SQL: `supabase/tests/01_structure.sql` (exactly 33 keys, `moderate_content` held only by `platform_admin`), `supabase/tests/04_permissions.sql` (helper results for each fixed seed identity), and `supabase/tests/06_invitation_acceptance.sql` (`evaluate_permission` grants plus invitation acceptance).

Application `can()`: `tests/permissions/can.test.ts`. Those tests fail early for UX; they do not replace the SQL enforcement in `supabase/tests/` or [conditional-permission-enforcement.md](../../docs/security/conditional-permission-enforcement.md). See [authentication.md](../../docs/authentication.md).
