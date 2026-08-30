# Permissions tests

**Not implemented yet.** The 33-action catalogue is accepted, but there is no authentication, no membership loading and no `can(actor, action, scope)` implementation, so there is nothing these tests can fail against.

Do not add placeholder permission tests here.

## First-schema obligation

When authentication and the policy layer exist, this directory becomes the mandatory permissions suite ([ADR-017](../../docs/decisions-and-open-questions.md#adr-017--vitest-playwright-and-mandatory-isolation-and-permission-suites)):

- Every cell in the [permissions matrix](../../docs/roles-and-permissions.md#4-permissions-matrix), positive and negative.
- Every conditional rule in that document.
- Fixed test identities from the deterministic seed dataset ([ADR-035](../../docs/decisions-and-open-questions.md#adr-035--deterministic-repeatable-seed-data-and-fixed-test-identities)).
- `moderate_content` refused without a reason, refused to `platform_support`, and unable to create or edit content.
