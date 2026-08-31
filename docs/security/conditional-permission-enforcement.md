# Conditional permission enforcement (C1–C19)

**Status:** Foundation schema on `feat/foundation-database-schema` · **Last updated:** 2026-08-31

This is the enforcement map for the conditional cells in [roles-and-permissions.md §5](../roles-and-permissions.md#5-conditional-rules). It records what the database already enforces, what a future product-module migration must add, and what the application `can(actor, action, scope)` layer will do for UX.

## Rules that do not move

- **The database is the final security boundary** for anyone who can call the Supabase Data API (`anon` / `authenticated`). Browser checks, hidden buttons and Server Action `can()` results must not be the only control for tenant isolation, private-data access, entitlements, platform authority, moderation quarantine, deactivation or privilege escalation.
- Application `can()` **fails early and improves UX**. It must not replace RLS, `CHECK` constraints, composite foreign keys or invoker triggers.
- A **conditional** matrix cell is **deny** at RLS until the condition can be evaluated against data that already exists. Treating `grant_kind = 'conditional'` as allow was rejected.
- Conditions that belong to tables that do not exist yet are **mandatory requirements on those future migrations**. This pass does not create feed, staff, events, bookings, offers, atmosphere, domain, analytics or notification tables just to close a cell.
- Helper: `app_private.effective_tenant_grant`. Allow cells stay allow. Conditional cells call `app_private.conditional_tenant_grant_ok`, which currently returns true only for **C2** (`venue_manager` / `assign_roles`, with table WITH CHECK) and **C13** (`view_audit_log`, with SELECT filters). Every other conditional cell is false.

`can()` tests will still live in `tests/permissions` once that layer exists. They are not a substitute for the SQL tests named below.

## Catalogue

### C1 — Venue manager invitations

| | |
| --- | --- |
| **Purpose** | A venue manager may invite only when the business owner has enabled that setting for the venue; only into their own venues; never `business_owner`. |
| **Tables / actions** | `invitations` INSERT/UPDATE; `invite_users` |
| **Enforced now** | Default **deny**. `venue_manager` / `invite_users` is conditional and `conditional_tenant_grant_ok` returns false. Business owners keep the allow cell. There is no owner-enabled setting column yet. |
| **Future migration** | When the setting exists, `conditional_tenant_grant_ok` (or the invitation WITH CHECK) must require it, own-venue scope, and role ≤ `venue_manager`. |
| **Application `can()`** | Hide the invite control when the setting is off; still not the security boundary. |
| **Negative tests** | Present: `05_conditional_and_security.sql` (manager INSERT denied; owner INSERT allowed). |

### C2 — Venue manager role assignment

| | |
| --- | --- |
| **Purpose** | Venue managers assign only venue-scoped memberships in venues they manage, at or below `venue_manager`, never themselves, never business-scoped. |
| **Tables / actions** | `venue_memberships`, `business_memberships`; `assign_roles` |
| **Enforced now** | Grant is effective for `venue_manager`. `app_private.may_write_venue_membership` requires own venue, not self, venue roles only. Business membership writes stay owner/platform. Platform assign_roles requires a support write session (C19). |
| **Future migration** | None for the rule itself. Later UI settings must not weaken WITH CHECK. |
| **Application `can()`** | Disable illegal role options in the form. |
| **Negative tests** | Present: self-assign denied, foreign venue denied, business membership denied, same-venue lower role allowed. |

### C3 — Staff toggling presence

| | |
| --- | --- |
| **Purpose** | Staff may toggle only their own presence, at a venue where they are active and have consented. |
| **Tables / actions** | Future `staff_profiles` / presence rows; `toggle_staff_presence` |
| **Enforced now** | Default **deny** (`conditional` → false). No presence table. |
| **Future migration** | RLS WITH CHECK: `user_id = current_user_id()`, active membership, consent. |
| **Application `can()`** | Hide the control when there is no public profile. |
| **Negative tests** | Present: helper is false for seed staff. Row-level tests required when the table ships. |

### C4 — Staff creating content

| | |
| --- | --- |
| **Purpose** | Staff may create drafts and submit them; live publishing is a different action. Approval-required is the venue default. |
| **Tables / actions** | Future feed/content tables; `create_content` |
| **Enforced now** | Default **deny** for staff `create_content`. |
| **Future migration** | INSERT as draft / `pending_approval` only; never `published`. |
| **Application `can()`** | Submit vs publish buttons. |
| **Negative tests** | Present: helper is false. Row-level tests required with the feed migration. |

### C5 — Content editor publish / events / offers

| | |
| --- | --- |
| **Purpose** | Allowed by default unless the venue requires manager approval, in which case the editor cannot publish directly. |
| **Tables / actions** | Future content, events, offers; `publish_content`, `manage_events`, `manage_offers` |
| **Enforced now** | Default **deny** for the three conditional editor cells. Manager/owner keep allow. |
| **Future migration** | WITH CHECK must read the venue approval setting; default-on approval must force `pending_approval`. |
| **Application `can()`** | Reflect the setting in the editor UI. |
| **Negative tests** | Present: helper is false for the editor on all three actions. |

### C6 — Atmosphere updates by editor / staff

| | |
| --- | --- |
| **Purpose** | Off by default; a venue may opt in so front-of-house can update atmosphere. |
| **Tables / actions** | Future atmosphere table; `manage_atmosphere` |
| **Enforced now** | Default **deny** for conditional cells. |
| **Future migration** | Require the opt-in setting on INSERT/UPDATE. |
| **Application `can()`** | Hide the control when opt-in is off. |
| **Negative tests** | Present: editor helper is false. Staff `manage_atmosphere` is also conditional and denied. |

### C7 — Venue manager analytics scope

| | |
| --- | --- |
| **Purpose** | Venue managers see analytics only for venues they manage, not business-wide aggregates. |
| **Tables / actions** | Future analytics tables; `view_analytics` |
| **Enforced now** | Default **deny**. |
| **Future migration** | SELECT USING `has_tenant_action_on_venue` after making the grant effective **and** scoping rows to `venue_id`. Business aggregates stay owner/platform. |
| **Application `can()`** | Route choice between venue and business dashboards. |
| **Negative tests** | Present: helper is false. Row-level tests required with analytics. |

### C8 — Booking manager analytics

| | |
| --- | --- |
| **Purpose** | Booking metrics only for their venues; no branding/feed/business-wide metrics. |
| **Tables / actions** | Future analytics / booking stats; `view_analytics` |
| **Enforced now** | Default **deny**. |
| **Future migration** | Column- and row-scoped SELECT policies, not a single wide analytics table readable by this role. |
| **Application `can()`** | Render only booking widgets. |
| **Negative tests** | Present: helper is false. Row-level tests required later. |

### C9 — Tenant exports

| | |
| --- | --- |
| **Purpose** | Venue manager: own venues, not business-level. Booking manager: booking data only. Personal-data exports are audited. |
| **Tables / actions** | Future export jobs / storage; `export_data` |
| **Enforced now** | Default **deny**. |
| **Future migration** | INSERT policy on the export job table must encode scope; writes to `audit_log` on personal-data exports. |
| **Application `can()`** | Disable illegal export types. |
| **Negative tests** | Present: helper is false for manager and booking manager. |

### C10 — Platform export

| | |
| --- | --- |
| **Purpose** | Operational exports only, inside a support session, audited. Not ordinary browsing. |
| **Tables / actions** | Future export path; `export_data` for `platform_admin` |
| **Enforced now** | No export table. `platform_may_write_tenant` / `platform_may_read_tenant` already require a live session. Seed sessions are ended, so the admin has no live harbor session. |
| **Future migration** | Export INSERT must require `platform_may_read_tenant` (or write, if the job mutates) plus a reason; audit every job. Must not use `manage_platform_tenants` alone. |
| **Application `can()`** | Support-session banner and reason field. |
| **Negative tests** | Present: no live write session on harbor-light. Job-table tests required later. |

### C11 — Platform access to private staff / booking customer details

| | |
| --- | --- |
| **Purpose** | Platform reads of private personal data only inside an active support session, with a reason, audited. Read-only unless write was granted separately. |
| **Tables / actions** | Future staff and booking tables; `view_private_staff_data`, `view_booking_customer_details` |
| **Enforced now** | No those tables. Platform SELECT on existing private tables (`users`, invitations, memberships) already requires tenant membership or `platform_may_read_tenant`. Support without a live session cannot read the subscription overview. |
| **Future migration** | SELECT USING `platform_may_read_tenant` (never role-alone). Writes using `platform_may_write_tenant`. |
| **Application `can()`** | Masking-by-default UI (OQ-17 remains open). |
| **Negative tests** | Present: support cannot `platform_may_read_tenant` harbor-light; editor cannot read `platform.admin`'s `users` row. Table-specific tests required later. |

### C12 — Venue manager domain request

| | |
| --- | --- |
| **Purpose** | Managers may request a custom domain; verification and activation stay platform. |
| **Tables / actions** | Future `venue_domains`; `manage_venue_domains` |
| **Enforced now** | Default **deny**. |
| **Future migration** | Tenant INSERT of `requested` rows only. `verified` / DNS / TLS columns platform-write-only (`manage_platform_tenants` or equivalent). |
| **Application `can()`** | Request vs verify buttons. |
| **Negative tests** | Present: helper is false. |

### C13 — Tenant-visible audit log

| | |
| --- | --- |
| **Purpose** | Owners see their business and venues; managers see their venues; nobody sees platform-internal entries. |
| **Tables / actions** | `audit_log` SELECT; `view_audit_log` |
| **Enforced now** | Grant is effective. `audit_log_select_tenant` requires `actor_platform_role IS NULL` plus venue or business scope. No UPDATE/DELETE grant. |
| **Future migration** | If extra tenant-visible columns are added, keep the platform-internal filter. |
| **Application `can()`** | Choose which columns to render (exact field set is OPEN). |
| **Negative tests** | Present: owner/manager cannot SELECT rows with `actor_platform_role` set; owner can see tenant-scoped seed rows. |

### C14 — Own presence for non-staff roles

| | |
| --- | --- |
| **Purpose** | Owner/manager/editor/booking-manager may toggle own presence only with an active membership, a public staff profile, and consent. |
| **Tables / actions** | Future staff profiles; `toggle_own_presence` |
| **Enforced now** | Default **deny** for conditional cells (owner/manager/editor/booking-manager). Staff `toggle_own_presence` is allow in the matrix; still no table to write. |
| **Future migration** | WITH CHECK on membership + public profile + consent. |
| **Application `can()`** | Hide when there is no public profile. |
| **Negative tests** | Present: owner helper is false. Row tests required later. |

### C15 — Account status gate

| | |
| --- | --- |
| **Purpose** | Only `active` accounts hold grants. `pending` / `suspended` / `deactivated` hold none (pending may only accept an invitation, which is not implemented yet). |
| **Tables / actions** | All helpers via `is_user_active()`; `users.account_status` |
| **Enforced now** | `is_user_active()` is required by tenant and platform helpers. Self-update of status/email/MFA is blocked by `protect_user_account_fields` (invoker). Deactivated self-update USING requires active, so reactivation matches zero rows. |
| **Future migration** | Invitation-accept path must allow pending users **only** to accept, still through RLS. |
| **Application `can()`** | Sign-out and “account disabled” messaging. |
| **Negative tests** | Present: deactivated seed user; pending and suspended editor; self-reactivation; self status change. |

### C16 — Subscription state gate

| | |
| --- | --- |
| **Purpose** | `restricted`: block configuration writes, keep public site. `suspended`: block writes and take the public site down. Reads/exports remain for data retrieval. |
| **Tables / actions** | `subscriptions.state`; venue writes; public SELECT |
| **Enforced now** | `subscription_allows_tenant_writes` is trial/active/past_due. `venue_is_publicly_visible` excludes suspended (and worse). Restricted seed venue stays publicly readable. |
| **Future migration** | New tenant-write tables must AND `subscription_allows_tenant_writes`. Export path (C9) must still work in restricted/suspended. |
| **Application `can()`** | Billing banners. |
| **Negative tests** | Present: anon reads restricted-room, not silent-room; owner UPDATE of both is zero rows. |

### C17 — Entitlement gate

| | |
| --- | --- |
| **Purpose** | Module actions require entitlement. Visibility toggles cannot create an entitlement. |
| **Tables / actions** | `venue_module_entitlements` (platform-write); `venue_module_settings`; `reject_unentitled_module_enable` |
| **Enforced now** | Tenant INSERT on entitlements denied. Enabling a module without entitlement raises `23514`. Night Orchid has an offers **deny** override. |
| **Future migration** | Module-specific tables must check `module_is_entitled` on write and public read. |
| **Application `can()`** | Disable unentitled module switches. |
| **Negative tests** | Present: settings INSERT for offers denied; entitlement INSERT denied (`03` and `05`). |

### C18 — Cross-venue copy

| | |
| --- | --- |
| **Purpose** | Copying or promoting an event requires authorisation in **both** venues, same business. |
| **Tables / actions** | Future events tables |
| **Enforced now** | No events tables (asserted). Do not implement copy as a single-scope `manage_events` write. |
| **Future migration** | Server operation or RLS that authorises source **and** destination `venue_id`, and `business_id` equality. Isolation tests must attempt a cross-business copy. |
| **Application `can()`** | Destination venue picker limited to same business. |
| **Negative tests** | Present: tables absent. Copy tests required with events. |

### C19 — Platform admin writes inside a tenant

| | |
| --- | --- |
| **Purpose** | Tenant-content writes (`manage_business`, `manage_venue`, branding, invite, assign_roles, public staff profiles) need an active support session with **write** access. Platform records (`manage_platform_tenants`, entitlements, platform users, domain verification) do not. `moderate_content` is excluded (ADR-036). |
| **Tables / actions** | `venues`, `businesses`, `invitations`, `venue_memberships`, translations; `support_sessions` |
| **Enforced now** | `protect_venue_platform_columns` and `protect_business_tenant_content` reject profile-field changes unless `platform_may_write_tenant`. Invitations INSERT and venue membership writes no longer accept `manage_platform_tenants` alone. Classification lock remains a platform record. First-owner business/venue **create** via `manage_platform_tenants` remains for operator onboarding. |
| **Future migration** | Branding, staff profiles, domain verification columns: content vs platform-record split must follow this same rule. |
| **Application `can()`** | Support banner; disable tenant edits outside write mode. |
| **Negative tests** | Present: admin cannot rename harbor venue/business, invite, or assign without a session; can lock classification; can edit city inside a live write session created in the test transaction. |

## Foundation helpers (quick reference)

| Helper | Role |
| --- | --- |
| `effective_tenant_grant` | Allow vs conditional-with-ok vs deny |
| `conditional_tenant_grant_ok` | Currently C2 and C13 only |
| `may_write_venue_membership` | C2 + C19 |
| `platform_may_read_tenant` / `platform_may_write_tenant` | C10, C11, C19 |
| `is_user_active` | C15 |
| `subscription_allows_tenant_writes` / `venue_is_publicly_visible` | C16 |
| `module_is_entitled` / `reject_unentitled_module_enable` | C17 |
| `apply_venue_moderation` | ADR-036; `authenticated` only, not `anon` |

## What `can()` must never be trusted for

Direct API access skips the Next.js tree. These properties are enforced in PostgreSQL today and must stay there:

- Tenant isolation and unpublished/foreign-row hiding
- Private `users` rows
- Entitlement and visibility split
- Platform role assignment
- Quarantine columns and republication
- Account deactivation / self-reactivation
- Privilege escalation through catalogues (`platform_roles`, `role_action_grants`, `modules`, `plans`, `entitlement_sources`)
