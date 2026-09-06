# Booking enquiries

**Status:** Implemented as the `booking_requests` module · **Last updated:** 2026-09-05

This module lets a guest send a **structured enquiry** to a venue and lets authorised venue users work a queue. It is **not** a reservation, inventory, table, deposit, payment or notification system ([ADR-024](./decisions-and-open-questions.md#adr-024--booking-requests-are-enquiries-not-reservations)).

Acknowledgement copy is always:

> Send an enquiry. This does not confirm a booking.

The product never claims that email was sent.

## Boundary

| In this milestone | Explicitly out |
| --- | --- |
| Display name, email, venue-local date/time, party size, optional short message, UI locale | Phone, LINE, assignment, internal notes, staff picker |
| States `new` → `in_review` → `closed` | `accepted`, `completed`, `no_show`, confirmed bookings |
| Close outcomes `handled`, `declined`, `duplicate`, `spam`, `withdrawn` | Customer-visible status, C18 copy to another venue |
| Database hourly quota (30/venue) + idempotency | Production bot/rate-limit vendor |
| Local and test public intake | Hosted production/staging public intake (fail-closed) |

`handled` means the venue recorded that it dealt with the enquiry. It is not a confirmed booking and does not notify the guest.

## Actions (existing catalogue only)

| Concern | Action |
| --- | --- |
| Queue reads (non-PII) | `view_bookings` |
| Customer name, email, message | `view_booking_customer_details` |
| Workflow writes | `manage_bookings` |
| Module settings / public visibility | `manage_venue_module_visibility` |

Owner, venue manager and booking manager are allowed those booking actions. Content editor and staff are denied. Platform reads of customer details require an active support session (C11). Platform workflow or settings writes require a write session (C19).

## Conditional rules

- **C11** — `may_read_booking_customer` ANDs queue access with `view_booking_customer_details` or `platform_may_read_tenant`.
- **C15** — deactivated users cannot pass `is_user_active()`.
- **C16** — public intake uses `venue_is_publicly_visible` (restricted venues may stay public; suspended/unpublished do not). Tenant writes still require `subscription_allows_tenant_writes`.
- **C17** — `may_read_booking_queue` ANDs `booking_module_entitled`. Historical leftover PII is not readable after entitlement ends. No extra access right is invented (OQ-22 remains open).
- **C19** — `may_manage_bookings` / `may_configure_booking_module` use `platform_may_write_tenant`.
- **No C18** — customer records stay on the original venue.

## Public intake

Route: `/[locale]/v/[venueSlug]/enquire`. Homepage CTA appears only when the module is publicly readable and accepting. Hiding the CTA does not create a working submit route: unpublished, unentitled, disabled or suspended venues render an unavailable page with no form.

The datetime field is labelled with the **venue timezone**. The database interprets `requested_local` with `AT TIME ZONE venues.timezone`. Device timezone is never used.

Idempotency keys are a UUID kept in React component state for that page view. Same key and same payload returns success without a second row. Same key and a different payload returns `conflict`. The RPC never returns an enquiry UUID or contact data.

`submit_booking_enquiry` is `GRANT`ed to `service_role` only. The app uses a **narrow server-only secret-key client** (`src/core/booking-requests/intake-client.ts`) that calls that RPC and nothing else. Anon and authenticated cannot execute it. Production and staging fail closed in `publicBookingIntakeAllowed` until a hosted abuse-control provider is accepted.

## Admin

- `/[locale]/admin/bookings` — wrapping filters (`ResponsiveFilterControls`), 44px View buttons, no customer emails on the list.
- `/[locale]/admin/bookings/[enquiryId]` — PII only when `view_booking_customer_details` is true. Optimistic `row_version`; stale writes return `conflict`.

## Unresolved (do not invent policy)

- **OQ-18** email delivery
- **OQ-22** retention after close
- **OQ-03 / OQ-04** privacy / PDPA
- **OQ-17** masking-by-default reveal
- No production rate-limit provider

## Security review (this milestone)

| Risk | Mitigation |
| --- | --- |
| RPC bypass | Intake EXECUTE revoked from PUBLIC/anon/authenticated. Tenant RPCs check `may_*` helpers. |
| Enquiry enumeration | Intake never returns IDs. Public errors are `unavailable` / `invalid_payload` / `conflict`. |
| Idempotency leak | Stored hashes only; duplicate success has no id. |
| XSS | No `dangerouslySetInnerHTML`. Customer text is React text. Settings reject `html`/`javascript`/`css`/`script` keys. |
| Definer / search_path | Empty `search_path`, fully qualified names, PUBLIC execute revoked on helpers. |
| Cache | Dynamic admin/public pages. Revalidate paths after writes; no CDN cache of PII. |
| C16 / C17 / C19 | Helpers above. Historical reads still require entitlement. |

See also [conditional-permission-enforcement.md](./security/conditional-permission-enforcement.md).
