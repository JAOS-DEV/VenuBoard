# Tenant-isolation tests

**Not implemented yet.** There is no schema and no Row Level Security policy, so there is nothing these tests can fail against.

Do not add placeholder isolation tests here. A suite that cannot fail is worse than none.

## First-schema obligation

When the first migrations land, this directory becomes the mandatory isolation suite ([ADR-017](../../docs/decisions-and-open-questions.md#adr-017--vitest-playwright-and-mandatory-isolation-and-permission-suites)):

- Every tenant table, translation tables included.
- Every operation: read, insert, update, delete.
- Public read paths and storage.
- Cross-venue parent/child mismatches must be **attempted and rejected** by database constraints ([ADR-037](../../docs/decisions-and-open-questions.md#adr-037--duplicated-tenant-keys-are-protected-by-composite-foreign-keys)).
- A venue must not be able to republish platform-quarantined content ([ADR-036](../../docs/decisions-and-open-questions.md#adr-036--moderate_content-as-a-platform-action)).

Measure the main RLS-sensitive query paths against representative seed data **before the schema becomes expensive to change** (OQ-30). See [decisions-and-open-questions.md section 4.1](../../docs/decisions-and-open-questions.md#41-obligations-on-the-first-implementation).
