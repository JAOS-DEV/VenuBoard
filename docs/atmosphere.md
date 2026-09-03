# Live venue atmosphere

**Status:** Implemented on `feat/live-atmosphere-module` · **Last updated:** 2026-09-03

This module lets authorised venue users publish **one temporary, subjective description** of how the venue feels right now. It is a promotional indicator for the public venue page.

It is **not** an occupancy counter, capacity monitor, safety or emergency system, attendance system, ticketing system, customer-tracking system, or sensor feed. VenuBoard does not count people, devices, noise, or cameras, and it does not make safety guarantees.

Related: [product-brief.md](./product-brief.md) · [data-model.md](./data-model.md) · [roles-and-permissions.md](./roles-and-permissions.md) · [security/conditional-permission-enforcement.md](./security/conditional-permission-enforcement.md)

## What guests see

When every public gate passes, the venue page shows a compact card with:

- a localised heading (English or Thai, with English fallback)
- one controlled status label
- restrained colour from semantic tokens **and** the same words in text, so colour is never the only signal

The card is omitted entirely when there is no eligible unexpired update. “No current update” is the absence or expiry of a row, not another stored state. The card never shows who changed it, exact timestamps, history, actor IDs, or internal venue IDs.

The venue’s independent 18+ notice is unchanged.

## Status vocabulary

Internal keys (text `CHECK`, not PostgreSQL enums):

| Key | English | Thai |
| --- | --- | --- |
| `calm` | Calm | สงบ |
| `social` | Social | สังคม |
| `lively` | Lively | คึกคัก |
| `high_energy` | High energy | พลังสูง |

These labels are application messages. Venues do not supply arbitrary public wording per level.

## Expiry

- Allowed durations: 30, 60, 90, 120, 180, 240, or 360 minutes
- Default: 2 hours
- Bounds: 30 minutes to 6 hours

Public correctness does **not** depend on a scheduled job or cache invalidation. `get_public_venue_atmosphere` treats `expires_at <= now()` as absent. Clearing deletes the current row immediately. The public page is `force-dynamic`; query-time expiry still applies if a cache is added later.

## Data model

### Current public state — `venue_atmosphere`

One row per venue: `venue_id`, `business_id` (ADR-037 composite FK), `atmosphere_state`, `set_at`, `expires_at`, `changed_by`, created/updated metadata.

Anonymous roles have **no** `SELECT` on this table. Public reads go through `get_public_venue_atmosphere`.

### Private history — `venue_atmosphere_events`

Append-only (`set` / `replace` / `clear`). Records previous/new state, actor, environment, expiry chosen, and source `rpc`. Updates and deletes are rejected. No emails, request payloads, profile data, or raw database errors.

Central `audit_log` also records the same transitions with `{state, expiry_minutes}` only.

### Module settings

Module key: **`atmosphere`** (existing `modules` catalogue). Settings live in `venue_module_settings` plus normalised `venue_module_setting_translations` for EN/TH public headings. JSON allowlist:

- `default_expiry_minutes`
- `front_of_house_may_update` (C6 opt-in, off by default)
- `presentation`: `card` | `compact` | `badge`

`css`, `javascript`, `html`, and `script` keys are rejected.

## Authorization

Action: **`manage_atmosphere`** (existing catalogue; not renamed).

| Role | Effect |
| --- | --- |
| Business owner | Allow, own businesses only |
| Venue manager | Allow, authorised venues only |
| Content editor / staff | Conditional (C6): only when that venue’s `front_of_house_may_update` is true |
| Booking manager | Deny |
| Platform role alone | Deny tenant content |
| Deactivated / unknown scope | Deny |

C16: restricted/suspended subscriptions remain publicly readable where publication gates pass; writes are denied. C17: entitled **and** enabled required to write. C19: platform tenant writes need a live write-mode support session. C11: private reads need a live scoped support session.

Application `can()` is fail-early UX. SQL/RLS and the definer RPCs are the security boundary. Client-supplied conditions never elevate permission. C6 is proven from the database setting, not from `conditional_tenant_grant_ok`.

Writes cannot change memberships or roles.

## Public query boundary

`get_public_venue_atmosphere(slug, locale)` returns `{ok, available}` when hidden, or heading, `status_key`, `presentation`, and `freshness: current` when shown. It checks publication, subscription/public availability, entitlement, enabled + publicly visible, unexpired state, and locale fallback. Hidden, expired, draft, quarantined, disabled, and not-entitled venues are indistinguishable to anonymous callers.

## Admin UI

`/admin/atmosphere` (dynamic, user-scoped). Four large status choices, bounded expiry selector, clear with confirmation, module states in human copy, recent private history without actor IDs, and heading/C6/presentation settings when `manage_venue_module_visibility` is granted.

## Deferred

Occupancy, sensors, cameras, device counting, opening-hours auto-clear, push notifications, social networks, customer-submitted status, public comments/ratings, Realtime (OQ-29), and custom per-level wording are out of scope.

No legal, safety, or real-time accuracy guarantee is made.
