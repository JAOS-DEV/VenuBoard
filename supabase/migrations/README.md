# Migrations

Forward-only SQL migrations, timestamp-prefixed, applied through the local
Supabase CLI and later through CI to every environment in the same order
([ADR-012](../../docs/decisions-and-open-questions.md#adr-012--sql-migrations-in-the-repository-forward-only)).
Nothing is ever changed by hand in the Supabase dashboard.

Current files:

- `20260831120000_foundation_schema.sql` — identity, tenants, memberships,
  invitations, permission catalogue, commercial reference data, subscriptions,
  entitlements, translations, audit, moderation, support-session boundary.
- `20260831120100_foundation_authorization.sql` — `app_private` helpers, RLS
  policies (per command), grants.

Obligations from [section 4.1 of the decision register](../../docs/decisions-and-open-questions.md#41-obligations-on-the-first-implementation):

- **Tenant-key integrity ships with the tables that need it** ([ADR-037](../../docs/decisions-and-open-questions.md#adr-037--duplicated-tenant-keys-are-protected-by-composite-foreign-keys)). `venue_translations` is the documented exception: parent id and tenant key are the same column.
- **The quarantine precondition ships with `venues`** ([ADR-036](../../docs/decisions-and-open-questions.md#adr-036--moderate_content-as-a-platform-action)).
- **RLS performance is measured** against the seed dataset — see [docs/performance/foundation-rls-baseline.md](../../docs/performance/foundation-rls-baseline.md).
- No PostgreSQL enum types ([ADR-031](../../docs/decisions-and-open-questions.md#adr-031--no-postgresql-enum-types)).
