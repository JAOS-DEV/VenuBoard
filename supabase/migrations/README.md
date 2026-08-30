# Migrations

Empty on purpose. No schema exists yet.

Forward-only SQL migrations live here, one logical change per file, timestamp-prefixed, applied through CI to every environment in the same order ([ADR-012](../../docs/decisions-and-open-questions.md#adr-012--sql-migrations-in-the-repository-forward-only)). Nothing is ever changed by hand in the Supabase dashboard.

Obligations that apply to the **first** migrations, from [section 4.1 of the decision register](../../docs/decisions-and-open-questions.md#41-obligations-on-the-first-implementation):

- **Tenant-key integrity ships with the tables that need it.** A table duplicating its parent's `venue_id` gets `UNIQUE (id, venue_id)` on the parent and a composite foreign key `(parent_id, venue_id)` → `(id, venue_id)` in the same migration ([ADR-037](../../docs/decisions-and-open-questions.md#adr-037--duplicated-tenant-keys-are-protected-by-composite-foreign-keys)). Added later it is a migration against live data.
- **The quarantine precondition ships with the publishable entities** ([ADR-036](../../docs/decisions-and-open-questions.md#adr-036--moderate_content-as-a-platform-action)).
- **RLS performance is measured early** against representative data, before the schema is expensive to change (OQ-30).
- No PostgreSQL enum types: `text` with `CHECK` constraints for workflow states, reference tables for commercial concepts ([ADR-031](../../docs/decisions-and-open-questions.md#adr-031--no-postgresql-enum-types)).
- RLS policies, grants, constraints and reference-table contents are part of the migration, not a follow-up.
