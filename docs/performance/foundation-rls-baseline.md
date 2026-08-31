# Foundation RLS performance baseline

**Captured:** 2026-08-31 · **Environment:** local Docker Supabase (`project_id = venuboard`) · **Obligation:** OQ-30 / [architecture.md §7.3](../architecture.md#73-rls-approach)

This is a **local baseline**, not production proof. Warm-cache `EXPLAIN (ANALYZE, BUFFERS)` as the table owner. Real `anon` / `authenticated` requests add RLS helper cost on top.

## How to reproduce

```bash
npm run supabase:start
VENUBOARD_ENV=local npm run db:reset          # small demonstration seed only
VENUBOARD_ENV=local npm run db:perf:seed      # large fixture; local-only; refused in production and staging
VENUBOARD_ENV=local npm run db:perf           # five documented paths
```

`db:reset` does **not** load the performance fixture. GitHub Actions does not run `db:perf:seed`. Restore a clean database with another `db:reset` afterwards.

## Dataset sizes

| Relation | After `db:reset` (ordinary seed) | After `db:perf:seed` |
| --- | --- | --- |
| `businesses` | 2 | 102 |
| `venues` | 16 named | 1,016 |
| `venue_translations` | 6 | 1,206 |
| `users` | 10 | 10 |
| `business_memberships` | 2 | 102 |
| `venue_memberships` | 9 | 5,009 |
| `venue_module_entitlements` | 76 | 10,076 |
| `subscriptions` | 16 | 1,016 |

The fixture uses reserved `example.com` identities only. 100 fictional businesses × 10 venues, five seed users as venue members, eight plan entitlements plus two extra trial rows per perf venue.

## Large-fixture plans (warm, 2026-08-31)

Measured with `npm run db:perf` after `ANALYZE` inside the fixture. Execution times are from the second pass.

### 1. Public venue resolution + translation lookup

`venues.slug = 'harbor-light'` joined to `venue_translations` for `en`.

| | |
| --- | --- |
| Plan | Nested loop left join. `venues`: **index scan on `venues_public_lookup_idx`**. `venue_translations`: **index scan on `venue_translations_venue_locale_idx`**. |
| Execution | 0.088 ms · 6 shared hits |
| Index used | `venues_public_lookup_idx`, `venue_translations_venue_locale_idx` |

At 16 ordinary-seed venues this path sequential-scanned `venues`. At 1,016 venues the partial public-lookup index is chosen. Keep it.

### 2. Business membership resolution

`business_memberships` for harbor owner (`…0010`), active, not deactivated.

| | |
| --- | --- |
| Plan | Sequential scan, 102 rows, filter kept 1 |
| Execution | 0.081 ms · 2 shared hits |
| Index present but unused | `business_memberships_user_business_idx` |

102 rows is still below the planner's index-scan threshold for this filter. Keep the index: helpers look up `(user_id, business_id)` as cardinality grows.

### 3. Venue membership resolution

`venue_memberships` for atlas manager (`…0021`), active, not deactivated.

| | |
| --- | --- |
| Plan | Bitmap heap scan, 1,002 rows. **Bitmap index scan on `venue_memberships_user_venue_idx`**. |
| Execution | 0.470 ms · 101 shared hits |
| Index used | `venue_memberships_user_venue_idx` |

### 4. Entitlement resolution

`venue_module_entitlements` for night-orchid / `feed`, not revoked.

| | |
| --- | --- |
| Plan | **Index scan on `venue_module_entitlements_lookup_idx`** |
| Execution | 0.063 ms · 3 shared hits |
| Index used | `venue_module_entitlements_lookup_idx` |

At ordinary-seed size this was a sequential scan. At 10,076 rows the lookup index is chosen. Keep it.

### 5. Representative venue-admin listing

Venues of perf business `21000000-0000-4000-8000-000000000001` (10 of 1,016 rows), ordered by name.

| | |
| --- | --- |
| Plan | Sort (quicksort) over **index scan on `venues_business_id_idx`** |
| Execution | 0.112 ms · 6 shared hits |
| Index used | `venues_business_id_idx` |

Ordinary seed listed Atlas's almost-entire table, so a sequential scan was honest. A tenant that owns a small share of rows uses the business_id index.

## Index decisions

No extra index was added after the large fixture. The indexes shipped with the first migration are the ones the planner now uses on the public, entitlement, membership and admin-list paths, except business memberships which remain a sequential scan at 102 rows.

- `venues_public_lookup_idx` — **used** at fixture size
- `venues_business_id_idx` — **used** for a 10-row tenant
- `venue_translations_venue_locale_idx` — **used**
- `business_memberships_user_business_idx` / `business_memberships_business_user_idx` — unused at 102 rows; keep
- `venue_memberships_user_venue_idx` / `venue_memberships_venue_user_idx` — **used**
- `venue_module_entitlements_lookup_idx` — **used**

## Known limitations

- Measured as the table owner, **without RLS policy overhead**. Repeat as `anon` / `authenticated` before treating a number as a budget.
- Not production scale and not a production-equivalent plan. Nested-loop membership helpers that look cheap here can become repeated index lookups per row in an admin list under RLS.
- Perf venues are uniformly published / active / core-plan plus two trial extra rows. They do not model a long tail of unpublished or mixed subscription states.
- `EXPLAIN` was not captured inside `app_private.module_is_entitled` (PL/pgSQL). Query 4 is the inner lookup that function performs.
- `business_memberships` has not reached a size where the planner prefers the user_id index.

## Ordinary-seed observation (kept for contrast)

Before the separate fixture, 16 venues produced sequential scans on public lookup, entitlements and Atlas's admin list. Those plans were not treated as missing indexes. The large fixture is what changed the planner's choice.
