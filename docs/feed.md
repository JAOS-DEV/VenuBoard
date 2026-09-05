# Venue feed / content

**Status:** Implemented on `feat/venue-feed-module` · **Last updated:** 2026-09-04

This module lets authorised venue users publish a **mobile-first stream of venue-authored announcements, updates and notices**. It is **not** a social network. There are no public accounts, comments, reactions, followers, direct messages, customer posts, structured offers, bookings, or automatic Facebook/Instagram/X publishing.

Related: [product-brief.md](./product-brief.md) · [data-model.md](./data-model.md) · [roles-and-permissions.md](./roles-and-permissions.md) · [security/conditional-permission-enforcement.md](./security/conditional-permission-enforcement.md) · [events-calendar.md](./events-calendar.md)

## Purpose and boundary

A feed post is **venue-authored public content**. Guests read it; they do not post it.

Supported post types (text `CHECK`, not PostgreSQL enums):

| Key | Meaning |
| --- | --- |
| `update` | Ordinary operational update |
| `announcement` | Promotional or time-sensitive announcement |
| `notice` | Practical notice |

There is **no** `offer` or `promotion` type. Prices, redemption and commercial promotions belong to the later offers module.

Initial content is **plain text**. React escaping stays intact. There is no Markdown rendering, no `dangerouslySetInnerHTML`, no arbitrary HTML, iframes, tracking pixels, or executable content. URLs typed in the body stay as text.

## Public surfaces

- Homepage preview on `/[locale]/v/[venueSlug]` when the venue is public, the module is entitled and enabled, homepage preview is on, and at least one eligible post exists.
- Full feed at `/[locale]/v/[venueSlug]/updates` with bounded cursor pagination.

Both omit the section entirely or show a generic empty/unavailable message when gates fail. Hidden drafts, pending, rejected, archived, quarantined or not-yet-due scheduled posts are not enumerated.

The venue 18+ notice is independent of the feed.

## State machine

```
[draft] --submit--> [pending_approval] --approve--> [draft] (approved_at set)
   |                      |
   |                   reject
   |                      |
   |              [draft] (editable, private rejection note)
   |
   +--publish now--> [published]
   +--schedule----> [scheduled]
[published] / [scheduled] --unpublish--> [draft]
any non-archived --archive--> [archived]
[archived] --restore--> [draft]
```

- Create always starts as `draft`.
- Changing the approval setting never auto-publishes an existing draft or rejected post.
- A rejection returns content to a private editable draft and keeps private approval history.
- Any material draft edit (post type or EN/TH title/body) clears `approved_at` / `approved_by`. While manager approval is required, publish and schedule need approval of the **current** content. The database reads the stored setting; the client cannot keep a stale approval.
- **Scheduled visibility is query-time.** A `scheduled` post becomes public only when `scheduled_for <= now()`. No background job is required. Unpublish hides immediately.

## Translations

`feed_post_translations` is an entity-specific table (not locale-keyed JSON).

- Unique `(post_id, locale)`
- Composite parent/tenant integrity (ADR-037)
- Locales: `en`, `th`
- English title and body are required before submit/publish
- Thai is optional; public RPC uses requested locale then English fallback
- Title 1–120 characters, body 1–2,000 characters

## Pinning

Authorised publishers may pin **published** posts. Maximum **three** publicly pinned posts per venue, enforced transactionally (`FOR UPDATE`). Archived, quarantined or unpublished posts cannot stay publicly pinned. Copying a post resets pin state.

Public ordering: pinned first, then publication time, then a stable id tie-breaker.

## Pagination

Public RPC `list_public_venue_feed(slug, locale, limit, cursor)`:

- Default page size 12, hard maximum 24
- Cursor is compact base64 JSON `{p, t, i}` (pin flag, sort timestamp, internal id). Cursors are **not** authorisation inputs. Newlines that PostgreSQL `encode(..., 'base64')` may insert are stripped so clients can round-trip the token.
- Malformed cursors return an empty page, not an error leak
- Anonymous roles have **no** `SELECT` on `feed_posts` or translations

Public fields: title, body, post type, public date, pin flag, locale. No post IDs, actor IDs, approval details, audit data, or media storage paths.

## Authorization (existing 33 actions)

Module key: **`feed`**. No new permission actions.

| Task | Action |
| --- | --- |
| Create/edit drafts and translations | `create_content` |
| Submit for approval | `submit_content_for_approval` |
| Approve/reject | `approve_content` |
| Publish, schedule, unpublish, pin, archive, restore | `publish_content` |
| Module settings / public visibility | `manage_venue_module_visibility` |
| Platform quarantine | `moderate_content` (platform admin only) |
| Same-business copy | `create_content` at **both** venues (C18); no dedicated copy action |

Booking managers receive none of these unless the matrix later grants them. Deactivated users, unknown scopes and platform roles alone deny. Support sessions follow C19 for tenant writes.

### C5 — editor publication

SQL is authoritative. `can()` stays conservative for editor `publish_content`.

- If `require_manager_approval` is **true** on that venue’s feed settings, editors may create/edit/submit and **cannot** approve their own post or publish directly.
- If the setting is **false**, editors may publish/schedule. The database reads the stored setting; the browser cannot send `approvalRequired: false`.

### C4 — staff drafts

Staff `create_content` remains **false** in the grant helper and in `can()`. SQL may still allow staff to create/submit drafts where the events pattern already does. The UI does not expose those controls unless `can()` proves them.

### C18 — copy

`copy_feed_post_to_venue` requires different venues, the same business, actor authorisation on both, and a writable entitled destination. The copy is a **new private draft** with new IDs. Translations copy. Approval, publication, schedule, archive, pin, moderation and media references do **not**. Cross-business copy is denied.

## Entitlement and settings

Distinguish: not entitled, entitled but disabled, enabled, active trial, expired, restricted/suspended.

Minimum settings (validated in SQL, not executable):

- module enabled / public visibility
- EN/TH public heading
- manager approval required
- homepage preview on/off and count (1–6)
- public horizon days (1–730)
- display density `comfortable` | `compact`

Only the platform changes commercial entitlements.

## Media placeholder

Production media upload is **deferred**. An optional venue-scoped `media_storage_path` may exist on the row. Remote URLs, `..`, backslashes, protocol strings and cross-venue paths are rejected. Public cards work without media. Copying a post does not copy the media path. No untrusted external URL is rendered.

## Moderation and audit

Quarantine columns follow existing publishable-entity patterns. Quarantined posts are not public and cannot stay pinned.

`feed_post_events` is append-only. Audit metadata may include identifiers, state transitions and safe reason codes. It must **not** include full post bodies, translations, emails, raw request payloads, authentication data or database errors.

## Admin UI

- `/[locale]/admin/feed`
- `/[locale]/admin/feed/new`
- `/[locale]/admin/feed/[postId]`

Dynamic, user-scoped. Capability flags only — the complete actor is not serialised into the client. SQL still enforces every write.

Filters: below `md` (768px) the list uses two labelled native selects (**Status** and **Content type**), stacked on very narrow widths. From `md` up, the same options wrap as chips. Neither layout uses horizontal scrolling. Query parameters `filter` and `type` are unchanged.

After publication, admin stays on the post. A secondary **View public updates** action opens `/[locale]/v/[venueSlug]/updates` for the selected venue. The link is built only from a stored venue slug that matches a bounded safe pattern; it never includes a post ID. The feed list shows the same restrained action when the selected venue has a valid slug.

Venue-admin navigation: a bottom bar is `md:hidden`; the compact header surface list is `hidden md:block`. Destinations are chosen by `venueAdminNavAccess` (`can()`), not by CSS. Hiding a tab is not the security boundary.

## Deferred

- Production media and video
- Automatic social-network publishing
- Comments, reactions, followers, customer posts
- Structured offers
- Recurring posts, analytics, personalisation, push notifications, AI generation
- Cross-business copy

## Mobile-first UI

Reuse `src/components/ui`, patterns and shells. Compact cards, 44px targets, EN/TH, light/dark/system, no horizontal overflow from 320px. Admin filters wrap or use labelled selects; they must not scroll sideways.

## Manual testing (product owner)

No SQL required. Fictional `example.com` identities only.

1. Start: `npm run local:start` then open http://localhost:3000/en/dev
2. Sign in as Harbor Owner (`harbor.owner@example.com`) from the local inbox
3. Open `/en/admin/feed` and choose **Harbor Light** (approval is off here)
4. Create a draft with English title and body; optional Thai
5. Publish now, then confirm the post on `/en/v/harbor-light` and `/en/v/harbor-light/updates`
6. Create another draft, set a future date, schedule it, and confirm it is absent from the public feed
7. Pin and unpin a published post; at most three pins
8. Unpublish, then archive; the post must leave the public feed. Restore keeps it private
9. Open `/th/v/harbor-light/updates` and confirm Thai copy or English fallback
10. Sign in as Atlas Editor (`atlas.editor@example.com`) at **Night Orchid**: submit for approval; you cannot approve your own post
11. Sign in as Atlas Manager (`atlas.manager@example.com`): approve, then publish; check `/en/v/night-orchid/updates`
12. As Harbor Owner, confirm you cannot operate Night Orchid’s feed. As Atlas Manager, Harbor Light is not in the venue list
13. Open Trial Partial (updates turned off) and Draft Room (not in plan) from Atlas Owner (`atlas.owner@example.com`)
14. Check 320px width and Light/Dark from the public theme control
15. Stop: `npm run supabase:stop`

