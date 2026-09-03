# Events calendar module

**Status:** Implemented on `feat/events-calendar-module` · **Last updated:** 2026-09-03

This is VenuBoard's second product module. It lets authorised venue users create and manage **venue events** with a public-facing calendar. It is **not** ticketing, booking, payment processing, attendance tracking, or a recurrence engine.

Related: [product-brief.md](./product-brief.md) · [data-model.md](./data-model.md) · [roles-and-permissions.md](./roles-and-permissions.md) · [security/conditional-permission-enforcement.md](./security/conditional-permission-enforcement.md)

---

## Event ownership

Events are owned by a `(venue_id, business_id)` composite. The composite foreign key references `venues (id, business_id)` so it is structurally impossible to create an event claiming a venue from a different business. This is enforced at the `events` table level; RLS is an additional layer.

Each event has exactly one owner venue. Cross-venue sharing is implemented via **copy** (C18), which creates a new independent draft in the destination venue.

---

## Translation model

Event text content (title, summary, description, CTA label) lives in a separate `event_translations` table joined to `events` via a composite FK `(event_id, venue_id)`. This prevents translations from claiming events that belong to a different venue.

Key properties:
- Each (event_id, locale) pair is unique — a unique constraint enforces this.
- Supported locales: `en`, `th` (enforced by a check constraint, not a PostgreSQL enum type).
- EN is required for all public-facing events. TH is optional; the public RPC falls back to EN when no TH translation exists.
- Translations are cascade-deleted when the parent event is deleted.
- The audit table (`event_workflow_events`) contains **no** translation content. Translation content cannot appear in the audit trail.

---

## Workflow and state model

### State machine

```
[draft] ──submit──> [draft/pending] ──approve──> [draft/approved]
   │                      │                          │
   │                   reject                     publish/schedule
   │                      │                          │
   │              [draft/rejected]              [published] or [scheduled]
   │                      │                          │
   └──────────────────────┘                        cancel
                                                     │
                                                [cancelled]
                                                     │
                                                  archive
                                                     │
                                                [archived]
```

The `state` column and `approval_status` column are **independent**:

| `state` | `approval_status` | Meaning |
|---|---|---|
| `draft` | `not_submitted` | New draft, editor is working |
| `draft` | `pending` | Submitted for manager approval |
| `draft` | `approved` | Approved, not yet published |
| `draft` | `rejected` | Rejected, back to editor |
| `scheduled` | `approved` | Approved, publishing at `publish_at` |
| `published` | `approved` | Live and public |
| `cancelled` | `approved` | Cancelled (was published) |
| `archived` | `approved` | Archived (finished/hidden) |

A `draft` event is **never** public, regardless of `approval_status`. Scheduled publication is evaluated at **query time** (not a background job): the public RPC checks `publish_at <= now()`.

### Restore to draft

`restore_event_to_draft` resets `state` to `draft` and `approval_status` to `not_submitted`. It can be called on cancelled or archived events. The workflow history is preserved (append-only).

---

## Approval vs scheduling

These are independent concepts:
- **Approval** (`approval_status`): manager sign-off on content. Controlled by `require_manager_approval` setting.
- **Scheduling** (`publish_at`): when the event becomes visible after approval. If `publish_at` is in the future, the event is in `scheduled` state. If null, publishing is immediate.

An editor who submits for approval always lands in `pending`. The manager approves or rejects. The manager (or owner) may then publish immediately or schedule for a future `publish_at`.

---

## Permission mapping (C5 for editors, C18 for copy)

### C5 — conditional editor publish

`content_editor` has a **conditional** grant for `publish_content` and `manage_events`. The condition is **never** modelled in `can()` context. The UX layer:

- Fetches `require_manager_approval` from the DB server-side (not from the client or from `can()` context).
- Shows/hides the Publish button based on that boolean.
- The DB RPC `may_publish_event` (via `publish_event_now`, `schedule_event_publication`) is the **final authority**. It independently checks `events_require_manager_approval(venue_id)`.

**Security note:** The `eventsApprovalRequired` field was removed from `AuthzContext` in this sprint. Any prior code that set it is a browser-controllable field that could not grant or deny actual DB writes — those were always enforced by the RPC — but it was misleading. The UX never relied on `can()` for editor publish; it now derives the setting server-side and passes it as a plain prop.

### C18 — cross-venue copy

`copy_event_to_venue` is guarded by `may_copy_event_to_venue` which checks:
1. Actor is authenticated and active.
2. Actor has `create_content` at the **source** venue.
3. Actor has `create_content` at the **destination** venue.
4. Source and destination are in the **same business**.

Cross-business copy is categorically denied. Same-business copy creates a new independent `draft` event in the destination venue. **What is NOT copied:**
- `poster_storage_path` (path is venue-specific)
- `approval_status` / `rejection_reason` (reset to `not_submitted`)
- `publish_at`, `published_at`, `cancelled_at`, `archived_at`
- `platform_quarantined_at` / quarantine data
- Source event reference (`source_event_id`, `source_venue_id` point to the copy origin but are informational only)

---

## Public visibility gates

All gates are enforced in SQL by the `events_module_public` and `event_is_publicly_visible` helpers. No application-layer gate is authoritative for public reads.

An event is publicly visible if **all** of:

1. Venue is published (`venue_is_publicly_visible`)
2. Events module is entitled (`events_module_entitled`)
3. Events module settings: `is_enabled = true` and `is_publicly_visible = true`
4. Event `state = 'published'` (not draft, scheduled, cancelled, or archived)
5. For scheduled events: `publish_at IS NULL OR publish_at <= now()` (query-time check)
6. `platform_quarantined_at IS NULL`
7. Event `cancelled_at IS NULL` and `archived_at IS NULL`

The scheduled-publication check is intentionally at query time. No cron job or background worker is required.

---

## Timezone semantics

- All datetimes in `events` are stored as `timestamptz` (UTC-anchored).
- `timezone` is an IANA identifier stored per-event. It represents the **display context** (the venue's local time), not an offset. The DB validates it against `pg_timezone_names`.
- `ends_at` is **exclusive** — it marks the instant the event ends. UI should display the time as the last visible moment, not the exclusive bound.
- Duration is bounded: `ends_at <= starts_at + interval '7 days'`. Events longer than 7 days are rejected.
- `is_all_day` events have `starts_at`/`ends_at` set to midnight UTC of the local date. The public RPC preserves these as timestamps; clients use `venueLocalDateISO` to format the display date.
- Overnight events (starting late and ending past midnight) are handled by comparing `venueLocalDateISO(starts_at)` vs `venueLocalDateISO(ends_at)`. If they differ, the summary shows a range.

---

## Same-business copy (C18)

See [Permission mapping](#permission-mapping-c5-for-editors-c18-for-copy) above. Copies:
- Event timing (`starts_at`, `ends_at`, `timezone`, `is_all_day`)
- All translation content (EN and TH titles, summaries, descriptions, CTA labels)
- `source_event_id` / `source_venue_id` links (informational)

Does not copy: poster path, approval/publication state, quarantine data.

---

## Module settings

Settings are stored in `venue_module_settings` with `module_key = 'events'`. The `settings` JSONB column is validated by `events_settings_shape_ok` before insert/update (trigger-enforced). Validated fields:

| Field | Type | Default | Notes |
|---|---|---|---|
| `default_display` | string | `calendar_and_list` | `upcoming_list` or `calendar_and_list` |
| `max_upcoming` | integer | 24 | 1–48 |
| `horizon_days` | integer | 90 | 1–366 |
| `show_past_archive` | boolean | false | Whether to show past events |
| `event_order` | string | `starts_at_asc` | `starts_at_asc` or `starts_at_desc` |
| `require_manager_approval` | boolean | false | C5 gate |

Headings are stored in `venue_module_setting_translations` (same table used by staff module). A `public_heading` override per locale renders above the public calendar.

Only `manage_venue_module_visibility` can change module settings (owner/manager). Editors cannot change `require_manager_approval`.

---

## Cancellation, archive, and restore

- **Cancel** (`cancel_event`): transitions `published` → `cancelled`. Removes from public. Requires a reason (optional). Sets `cancelled_at`.
- **Archive** (`archive_event`): transitions `published` / `cancelled` / `draft` → `archived`. Sets `archived_at`.
- **Restore to draft** (`restore_event_to_draft`): transitions `cancelled` / `archived` / `draft` → `draft`, resets approval status. Clears `cancelled_at` and `archived_at`.

---

## Poster upload (deferred)

Poster image upload is deferred. The `poster_storage_path` column accepts a relative path placeholder (validated format: `venues/<venue_id>/events/<event_id>/...`, no `..` traversal, no external URLs). The UI notes this deferral explicitly. Paths are not copied during cross-venue copy because the path includes the source venue ID.

---

## Recurrence (deferred)

`recurrence_rule` column is reserved and unused. Recurring event creation, modification, and exception handling are deferred to a future sprint.

---

## Ticketing / payments / bookings (deferred)

Events have no ticket inventory, pricing, or payment logic in this version. The `view_bookings` and `manage_bookings` actions in the permission catalogue are for a future bookings module.

---

## Calendar integrations (deferred)

iCal / Google Calendar / `.ics` export are deferred. No webhook or push mechanism exists.

---

## Security and RLS enforcement

- All three event tables have **forced RLS** (`ALTER TABLE ... FORCE ROW SECURITY`).
- Anonymous users cannot `SELECT` from any event table directly. Public reads go through the `list_public_venue_events` RPC.
- All write RPCs are `SECURITY DEFINER` with `search_path = ''`. `EXECUTE` is revoked from `PUBLIC`; only `authenticated` is granted execute.
- The `events_protect_quarantine` trigger prevents non-platform-admin users from modifying quarantine columns.
- Quarantined events cannot transition to `published` or `scheduled` (check constraint).
- The public RPC output contains only: `id`, `starts_at`, `ends_at`, `timezone`, `is_all_day`, `title`, `summary`, `description`, `cta_label`, `locale`. No `approval_status`, `rejection_reason`, `actor_user_id`, or audit fields.

---

## Legal / policy open questions

- **OQ-events-01**: Cancellation notification to attendees — no email/push exists yet. Legal obligation for refunds (if ticketing is later added) is not addressed.
- **OQ-events-02**: 18+ event classification for events within an 18+ venue — the venue classification applies to the venue page, but per-event age restriction is not modelled.
- **OQ-events-03**: PDPA / GDPR implications of storing event attendee data (future bookings module).
- **OQ-events-04**: Archival retention policy — archived events are retained indefinitely; no purge schedule exists.
- **OQ-events-05**: Recurrence and exception handling — dates and rules for multi-occurrence events are entirely deferred.
