# Offers

**Status:** Implemented on `feat/offers-module` · **Last updated:** 2026-09-06

This module lets authorised venue users publish **venue-authored promotional information** with explicit validity, translations, approval and publication controls. It does **not** process payments, issue redeemable vouchers, track redemption, or guarantee availability.

Related: [product-brief.md](./product-brief.md) · [data-model.md](./data-model.md) · [roles-and-permissions.md](./roles-and-permissions.md) · [security/conditional-permission-enforcement.md](./security/conditional-permission-enforcement.md) · [feed.md](./feed.md)

## Purpose and boundary

An offer is **informational public copy**. Guests read it; they do not claim, pay for, or redeem it in this milestone.

| In this milestone | Explicitly out |
| --- | --- |
| Plain-text EN/TH title, description and terms | Checkout, deposits, refunds |
| Explicit finite validity (`valid_from` inclusive, `valid_until` exclusive) | Vouchers, QR codes, customer claims |
| Draft, approval, publish now, scheduled publication, unpublish, archive, restore | Inventory or availability guarantees |
| Query-time public expiry (no cron) | Percentage-discount engines, reference prices |
| Homepage preview and public list | Loyalty, customer accounts, customer-submitted offers |
| Module settings and entitlements | Recurrence / happy-hour schedules |
| Privacy-safe audit history | Social-media publishing, production image uploads |

Publishing an offer does **not** establish legal compliance. Promotional-content and legal review remains outstanding. Seed and test copy is fictional food or entertainment only.

C18 copy is **not** authorised for offers. Do not reuse the feed/events copy RPC.

## Module key and actions

Authoritative catalogue key: **`offers`**.

| Concern | Existing action |
| --- | --- |
| Create and edit drafts + translations | `create_content` |
| Submit | `submit_content_for_approval` |
| Approve / reject | `approve_content` (owner/manager; editors cannot self-approve) |
| Publish, schedule, unpublish, archive, restore | `publish_content` and `manage_offers` |
| Module settings | `manage_venue_module_visibility` |
| Quarantine | `moderate_content` (platform admin) |

No invented actions. Staff and booking managers have no offer grants. Application `can()` stays conservative for editor `publish_content` / `manage_offers` (C5). The database reads `require_manager_approval` from stored **offers** settings.

## Publication versus validity

These clocks are separate:

- **Publication state** (`draft` / `pending_approval` / `scheduled` / `published` / `archived`) controls whether content has been released.
- **Optional `scheduled_for`** controls when a scheduled release takes effect (`scheduled_for <= now()` at query time).
- **Validity** (`valid_from`, `valid_until`) defines when the promotion applies.

Public cards appear **only while the offer is valid**. There are no public teasers before `valid_from`.

Semantics:

- `valid_until > valid_from` (required, finite expiry)
- Start-inclusive, end-exclusive: `valid_from <= now() < valid_until`
- Venue-local `YYYY-MM-DDTHH24:MI` is converted with the venue timezone (`AT TIME ZONE` in SQL; application conversion uses the same zone). Invalid or ambiguous local times are rejected. The operator’s browser timezone is not used.
- Admin **Upcoming / Active / Expired** labels are derived from timestamps. There is no stored expired flag and no background job.
- Public eligibility is re-evaluated on each read. Unpublish, archive, quarantine and expiry hide the offer on the next public query. Open browser tabs hide cards at the exclusive `valid_until` instant, then refresh via a lightweight timer and `visibilitychange`; the database remains authoritative.

Public display requires all of:

- Venue publicly available
- Offers module entitled, enabled and publicly visible
- Published, or scheduled publication time reached
- Current time within validity
- Approval of the **current** content when the venue requires manager approval
- Not archived or quarantined
- Subscription/moderation rules permit display (C16 restricted keeps public content; suspended takes it down)

## Approval

Feed-style workflow:

```
[draft] --submit--> [pending_approval] --approve--> [draft] (approved_at set)
   |                      |
   |                   reject
   |                      |
   |              [draft]
   +--publish now--> [published]
   +--schedule----> [scheduled]
[published] / [scheduled] --unpublish--> [draft]
any non-archived --archive--> [archived]
[archived] --restore--> [draft]
```

- Restore returns a **private draft** with approval, schedule and publication cleared. It never auto-reactivates an expired offer.
- Material edits (EN/TH title, description, terms; adding/removing translations; validity; optional media path) clear `approved_at` / `approved_by`.
- Published and scheduled rows are not editable in place; unpublish first.
- Changing module settings never auto-publishes drafts.
- RPCs take `FOR UPDATE` so concurrent edit/approval/publish cannot approve one version and publish another.
- Editors cannot self-approve (`submitted_by = actor`).

## Public and admin surfaces

- Homepage preview on `/[locale]/v/[venueSlug]` when preview is on and at least one eligible offer exists. Cards show title, short description and validity — **not** full terms.
- Full list at `/[locale]/v/[venueSlug]/offers` with terms, bounded cursor pagination (`{t,i}` on `valid_from`, `id`), requested locale then English fallback.
- Admin: `/[locale]/admin/offers`, `/new`, `/[offerId]`.

Public responses omit ids, actors, approval fields and audit payloads. Anonymous roles have **no** `SELECT` on `offers`, `offer_translations` or `offer_events`.

The venue 18+ notice is independent of offers.

## Settings

Per-venue `venue_module_settings` for `offers`:

- Enabled / publicly visible
- EN/TH public heading
- `require_manager_approval`
- Homepage preview on/off and count 1–6

Only platform operators alter commercial entitlements. Night Orchid keeps an offers **deny** override (C17).

## Media and money

Production uploads are deferred. If a storage path is supplied it must be `venues/<venue_id>/offers/...`. Remote URLs, traversal and cross-venue paths are rejected.

This milestone has **no structured money fields**. Promotional text and terms carry any price wording. Do not treat that copy as a pricing engine.

## Manual guide (local seed)

Leave ordinary Next.js (`http://localhost:3000`) and local Supabase running. Do not reset the shared database unless you have permission.

1. **Create an offer.** Sign in as `harbor.owner@example.com`. Open `/en/admin/offers`, select Harbor Light, enable the module if needed, then Create offer. English title, description and terms are required. Times are in `Asia/Bangkok`.
2. **Publish and view it publicly.** Publish now, then View public offers (`/en/v/harbor-light/offers`). The card should appear on the homepage preview when preview is on.
3. **Approval then edit.** At Trial Garden (approval on), sign in as `atlas.editor@example.com`, create and submit. `atlas.manager@example.com` can approve. The editor cannot self-approve. Editing title, description, terms or validity clears approval; publish stays blocked until the current content is approved again.
4. **Future / expired visibility.** Publish with a future `valid from` — it stays off the public list. Publish with a short `valid until`, leave `/en/v/harbor-light/offers` open, and wait; the card disappears after expiry without a full reload job.
5. **Unpublish / archive / restore.** Unpublish or archive removes the public card immediately. Restore returns a private draft even if validity still covers now.
6. **Denied persona.** `atlas.bookings@example.com` has no offers action. Night Orchid (`atlas.owner@example.com`) is not entitled for offers.
7. **Mobile, Thai, dark mode.** Check 390px width, `/th/v/harbor-light/offers` (EN fallback when Thai is absent), and dark theme. Primary targets stay 44px.
