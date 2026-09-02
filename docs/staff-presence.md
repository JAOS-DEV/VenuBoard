# Staff directory and live presence

**Status:** Implemented on `feat/staff-presence-module` · **Last updated:** 2026-09-01

This is VenuBoard’s first product module. It lets authorised venue users manage **public staff profiles** and mark people as **present** or **not present**. It is **not** payroll, timekeeping, shift scheduling, GPS verification, or an employment attendance system.

Related: [product-brief.md](./product-brief.md#62-staff-presence) · [data-model.md](./data-model.md#5-staff-public-and-private-data) · [roles-and-permissions.md](./roles-and-permissions.md) · [security/conditional-permission-enforcement.md](./security/conditional-permission-enforcement.md)

## Public profile versus private staff record

| | Private `staff_members` | Public `staff_public_profiles` |
| --- | --- | --- |
| Scope | Business | Venue (one assignment per staff member per venue) |
| Public site | Never | Only when every publication gate passes |
| Typical fields | Internal display name, optional `user_id`, active/deactivated | Public name, optional title, bio translations, consent, publication, display order |
| Actions | `view_private_staff_data` to read; create/deactivate via `manage_public_staff_profiles` | `manage_public_staff_profiles`, `manage_own_public_profile`, `manage_own_consent` |

A linked login is optional. Managers can create a public-facing profile for someone who does not yet have a VenuBoard account. The same authenticated user may have **separate** staff records in different businesses; those records are never merged because the email matches.

There is **no** `manage_staff` action. Creating and deactivating the private business record is mapped to `manage_public_staff_profiles` at the first (or each) assignment venue. The 33-action catalogue is unchanged.

Private legal identity, home address, date of birth, phone, salary, attendance totals and sensitive notes are **not stored**.

## Multi-venue assignment

A staff member may be assigned to several venues in the same business. Each venue has its own public name, title, bio, consent, publication state and presence. Cross-business assignment is rejected.

## Consent and publication

Public appearance requires **all** of:

1. Venue is publicly published (`venue_is_publicly_visible`)
2. `staff_presence` is entitled
3. The module is enabled and publicly visible
4. The private staff record is active
5. The venue assignment is active
6. The public profile is `published`
7. Consent is `granted`
8. The profile is not platform-quarantined

Presence alone never publishes an otherwise private profile.

Consent states: `pending`, `granted`, `withdrawn`. Grant and withdrawal are timestamped with the acting user. Withdrawal immediately hides the profile, even if currently marked present.

**A manager clicking “consent granted” is an operational record.** It does not prove that legally valid consent was obtained from the person. Final consent wording and procedure remain subject to policy and legal review (OQ-03, OQ-04).

Linked users may grant or withdraw **their own** consent with `manage_own_consent`.

## Presence and expiry

Public states are `present` and `not_present` (not `in` / `not_in`). This is a promotional “in now” indicator.

When someone is marked present, `presence_expires_at` is set to **now plus a bounded duration** from module settings (`presence_expiry_hours`, 1–24, default 12). The public query treats an expired row as `not_present` **without a background job**. Managers can mark not present immediately. Bulk reset is confined to one venue.

Opening-hours integration is **not implemented**. The hour duration is a documented temporary setting and the future hook is this expiry timestamp, which can later be aligned to closing time in the venue timezone.

Public responses never include who changed the status, exact attendance history, internal staff ids, private user ids, or audit rows.

## Deactivation and restoration

Deactivation preserves rows and history, removes the person from public display, blocks presence changes, and marks all venue presence `not_present`. Translations and assignments are not deleted.

Restoration does **not** republish, restore granted consent, or mark the person present. Profiles return to `draft` / `pending` (or stay `withdrawn`) and `not_present`.

## Entitlement and configuration

Module key: **`staff_presence`** in `modules`. Commercial entitlement remains platform-only. Authorised venue users may enable/disable the module only with `manage_venue_module_visibility`.

Admin UI distinguishes: not entitled, entitled but disabled, enabled, trial, expired, restricted, suspended.

Settings (non-executable JSON only): public heading EN/TH, `present_only` vs `all_published`, carousel order, presence expiry hours, auto-advance on/off.

## Authorization (C3, C11, C14, C16, C17, C19)

| Rule | Enforcement |
| --- | --- |
| C3 staff toggle | `conditional_tenant_grant_ok` stays **false** so staff never get a blanket `has_tenant_action_on_venue('toggle_staff_presence')`. `may_set_staff_presence` allows **own** presence only, with active membership and granted consent. |
| C14 own presence | Same helper: non-staff with membership + public profile + consent. Application `can()` proves the cell with `ownConsentedStaffProfile`. |
| C11 private staff | `staff_members` SELECT requires `view_private_staff_data` or `platform_may_read_tenant`. No anonymous policy. |
| C16 | Writes AND `subscription_allows_tenant_writes`. Restricted venues stay publicly readable. |
| C17 | Writes require `module_is_entitled('staff_presence')`. Public RPC also requires enabled + visible. |
| C19 | `may_manage_public_staff_profiles` includes `platform_may_write_tenant`. Platform admin has **no** `toggle_staff_presence` cell. |

Writes go through SECURITY DEFINER RPCs (`search_path = ''`, PUBLIC execute revoked, codes-only errors). Anonymous users cannot SELECT staff tables; `list_public_staff_presence` is the public read.

The venue-admin selector cookie (`vb_admin_scope`) is honoured for a venue membership **or** a business-owner membership of that venue’s business. It is not inferred from an unrelated staff assignment at another venue.

Nobody can self-assign a higher role or venue membership through staff records. Staff rows do not write `venue_memberships`.

## Avatar upload

Deferred. Optional `avatar_storage_path` must match `venues/<venue_id>/staff_presence/<file>` and cannot be a remote URL. The UI renders initials only. Future storage must stay venue-scoped.

## Caching

Admin pages are `force-dynamic`. Public staff is queried per request with venue slug + locale. Presence, consent, deactivation and module disablement take effect on the next request.

## Unresolved legal / policy items

- OQ-03 / OQ-04: PDPA/GDPR consent wording and lawful basis
- OQ-17: masking private staff data by default
- OQ-21: later replace hour expiry with opening-hours-based reset
- OQ-24: per-person profile metrics (not implemented; aggregate-only remains the default)
