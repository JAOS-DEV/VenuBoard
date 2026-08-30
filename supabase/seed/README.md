# Seed data

Empty on purpose. There is no schema to seed.

`supabase/config.toml` points `[db.seed].sql_paths` at `./seed/*.sql`, so a reset currently seeds nothing rather than failing.

When this directory is filled it must follow [ADR-035](../../docs/decisions-and-open-questions.md#adr-035--deterministic-repeatable-seed-data-and-fixed-test-identities) and the coverage list in [docs/data-model.md section 14](../../docs/data-model.md#14-seed-data-for-local-and-staging):

- **Deterministic**: fixed UUIDs and timestamps relative to a seed epoch, so repeated runs produce identical databases.
- **Fictional only**: no genuine customer or staff data, and no venue that resembles a real venue in the target cities.
- **Local and staging only**: `npm run db:reset` and `npm run db:seed` refuse to run when `VENUBOARD_ENV=production`.
- Reference data (`modules`, `plans`, `plan_modules`, `entitlement_sources`) is **not** seed data — it ships in migrations so production gets it without demo content.
