# Seed data

Deterministic fictional dataset ([ADR-035](../../docs/decisions-and-open-questions.md#adr-035--deterministic-repeatable-seed-data-and-fixed-test-identities)).

`supabase/config.toml` points `[db.seed].sql_paths` at `./seed/01_foundation.sql`, `./seed/02_staff_presence.sql`, `./seed/03_events.sql`, then `./seed/04_atmosphere.sql`.

The large RLS performance fixture is **not** seed data. It lives in `supabase/perf/` and is loaded only by `npm run db:perf:seed`.

Rules:

- **Deterministic**: fixed UUIDs and timestamps relative to 2026-08-01 00:00:00 UTC. `02_staff_presence.sql` extends Trial Garden entitlement `ends_at` to `now() + 30 days` so the “active full trial” fixture remains entitled after that epoch window.
- **Fictional only**: `example.com` addresses, invented venue names that do not resemble real venues in the target cities.
- **Local and staging only**: `npm run db:reset` and `npm run db:seed` refuse to run when `VENUBOARD_ENV=production`.
- Auth users are created with **random unusable password hashes**. SQL tests impersonate via JWT `sub` claims (`request.jwt.claim.sub` / `request.jwt.claims`) and `SET ROLE`. They do not log in interactively.
- The pending Night Orchid invitation uses token `local-invite-atlas-editor-v1` (SHA-256 stored in `token_hash`). That string is an invitation token for local inspection, not a login password.
- Reference data (`modules`, `plans`, `plan_modules`, `entitlement_sources`, the 33 actions) is **not** seed data — it ships in migrations.

SQL tests: `npm run db:test` (`supabase test db`, pgTAP under `supabase/tests/`). Database CI locally: `npx supabase start && npm run db:reset && npm run db:test && npm run db:types:check && npx supabase stop`.
