# VenuBoard — Decisions and Open Questions

**Status:** All scaffolding decisions accepted · **Stage:** Pre-scaffold documentation · **Last updated:** 2026-08-30

This document records **why** the architecture looks the way it does, and — just as importantly — **what has not been decided**. No application code exists yet.

Three kinds of entry:

- **ADR** — an architecture decision record. `Accepted` means agreed and safe to build on. `Proposed` means *recommended, not yet agreed*.
- **OQ** — an open question. Unresolved. No OQ may be treated as settled, and none has been silently assumed elsewhere in the documentation. Resolved questions are **kept with their resolution recorded** rather than deleted — see [Resolved questions](#34-resolved-questions).
- **Decision history** — the dated audit trail of what changed and why, in [section 6](#6-decision-history).

Related: [product-brief.md](./product-brief.md) · [architecture.md](./architecture.md) · [data-model.md](./data-model.md) · [roles-and-permissions.md](./roles-and-permissions.md)

---

## 1. Decision summary table

**Accepted on 2026-08-30**, across two rounds on the same day: ADR-001 to ADR-010, ADR-013 and ADR-014 (both amended), and the new records ADR-028 to ADR-035 in the first round; then ADR-012, ADR-017, ADR-020, ADR-022, ADR-023, ADR-024, ADR-025 and the new records ADR-036 to ADR-038 in the second.

**Nothing in this register now blocks initial application scaffolding.** The remaining `Proposed` records are non-blocking preferences, and every open question is either a launch blocker or a feature-specific decision with a recorded provisional boundary — see [section 4](#4-decisions-needed-before-application-scaffolding).

| ID | Decision | Status | Blocks scaffolding? |
| --- | --- | :--: | :--: |
| [ADR-001](#adr-001--one-shared-multi-tenant-platform) | One shared multi-tenant platform; no per-venue deployment or database | **Accepted** 2026-08-30 | — |
| [ADR-002](#adr-002--modular-monolith-not-microservices) | Modular monolith, not microservices | **Accepted** 2026-08-30 | — |
| [ADR-003](#adr-003--nextjs-app-router-with-typescript-in-strict-mode) | Next.js App Router + TypeScript strict mode | **Accepted** 2026-08-30 | — |
| [ADR-004](#adr-004--supabase-as-the-managed-platform-layer) | Supabase for PostgreSQL, auth, storage, realtime, RLS | **Accepted** 2026-08-30 | — |
| [ADR-005](#adr-005--tenant-isolation-through-rls-and-application-authorisation) | Tenant isolation via RLS **and** application authorisation | **Accepted** 2026-08-30 | — |
| [ADR-006](#adr-006--a-direct-tenant-key-on-every-tenant-owned-table) | Direct `venue_id` / `business_id` on every tenant table | **Accepted** 2026-08-30 | — |
| [ADR-007](#adr-007--action-based-permissions-with-fixed-mvp-roles) | Action-based permissions; fixed MVP roles; full action catalogue accepted | **Accepted** 2026-08-30 | — |
| [ADR-008](#adr-008--entitlement-and-venue-configuration-are-separate-concepts) | Entitlement (operator) separate from venue configuration (customer); base plan + optional modules + module trials + overrides | **Accepted** 2026-08-30 | — |
| [ADR-009](#adr-009--public-staff-data-separated-from-private-data-with-explicit-consent) | Public staff data separated from private data, consent required | **Accepted** 2026-08-30 | — |
| [ADR-010](#adr-010--structured-content-only--no-custom-css-javascript-or-html) | Structured content only; no custom CSS/JS/HTML | **Accepted** 2026-08-30 | — |
| [ADR-011](#adr-011--tailwind-and-shadcnui-with-css-custom-property-theming) | Tailwind + shadcn/ui, venue theming via CSS custom properties | Proposed | No |
| [ADR-012](#adr-012--sql-migrations-in-the-repository-forward-only) | SQL migrations in the repository, forward-only | **Accepted** 2026-08-30 | — |
| [ADR-013](#adr-013--email-password-and-magic-link-authentication-with-mfa-support) | Email password **and** magic link auth; MFA supported, mandatory for platform accounts before launch | **Accepted** 2026-08-30 (amended) | — |
| [ADR-014](#adr-014--invitation-based-onboarding) | Invitation-based business and venue onboarding | **Accepted** 2026-08-30 (amended) | — |
| [ADR-015](#adr-015--next-intl-for-english-and-thai) | `next-intl` for English and Thai interface strings | Proposed | No |
| [ADR-016](#adr-016--zod-for-validation-react-hook-form-for-complex-forms) | Zod for validation; React Hook Form for complex forms | Proposed | No |
| [ADR-017](#adr-017--vitest-playwright-and-mandatory-isolation-and-permission-suites) | Vitest + Playwright, with mandatory isolation/permission suites | **Accepted** 2026-08-30 | — |
| [ADR-018](#adr-018--vercel-hosting-with-manual-custom-domains-for-the-mvp) | Vercel hosting; manual custom domains in MVP | Proposed | No |
| [ADR-019](#adr-019--manual-billing-state-in-the-mvp-stripe-later) | Manual billing state in MVP; Stripe later | Proposed | No |
| [ADR-020](#adr-020--venue-routing-by-subdomain-custom-domain-and-vslug-fallback) | Routing by subdomain, custom domain, `/v/[slug]` fallback | **Accepted** 2026-08-30 | — |
| [ADR-021](#adr-021--first-party-analytics-stored-in-postgresql) | First-party analytics stored in PostgreSQL | Proposed | No |
| [ADR-022](#adr-022--support-access-is-read-only-by-default-and-session-gated) | Support access read-only by default, session-gated, audited | **Accepted** 2026-08-30 | — |
| [ADR-023](#adr-023--deactivation-rather-than-destructive-deletion) | Deactivation rather than destructive deletion | **Accepted** 2026-08-30 | — |
| [ADR-024](#adr-024--booking-requests-are-enquiries-not-reservations) | Booking requests are enquiries; no inventory, no deposits | **Accepted** 2026-08-30 | — |
| [ADR-025](#adr-025--per-venue-content-classification-with-an-operator-override) | Per-venue content classification with operator override | **Accepted** 2026-08-30 | — |
| [ADR-026](#adr-026--no-pinned-package-versions-yet) | No pinned package versions yet | Proposed | No |
| [ADR-027](#adr-027--recurring-events-postponed-with-a-reserved-field) | Recurring events postponed; recurrence field reserved | Proposed | No |
| [ADR-028](#adr-028--normalised-entity-specific-translation-tables) | Normalised, entity-specific translation tables for multilingual content | **Accepted** 2026-08-30 | — |
| [ADR-029](#adr-029--a-30-day-trial-grants-all-mvp-modules-by-default) | 30-day trial grants all MVP modules by default, with operator exclusions | **Accepted** 2026-08-30 | — |
| [ADR-030](#adr-030--subscriptions-are-venue-scoped) | Subscriptions are venue-scoped, with a business-level combined overview | **Accepted** 2026-08-30 | — |
| [ADR-031](#adr-031--no-postgresql-enum-types) | No PostgreSQL enum types: text + `CHECK` for workflow states, reference tables for commercial concepts | **Accepted** 2026-08-30 | — |
| [ADR-032](#adr-032--supabase-region-ap-southeast-1-aws-singapore) | Supabase region `ap-southeast-1` (AWS Singapore) | **Accepted** 2026-08-30 | — |
| [ADR-033](#adr-033--operator-led-onboarding-no-self-service-signup-in-the-mvp) | Operator-led onboarding; no public self-service signup in the MVP | **Accepted** 2026-08-30 | — |
| [ADR-034](#adr-034--three-fully-isolated-environments-local-staging-production) | Three fully isolated environments: local, staging, production | **Accepted** 2026-08-30 | — |
| [ADR-035](#adr-035--deterministic-repeatable-seed-data-and-fixed-test-identities) | Deterministic, repeatable seed data and fixed automated-test identities | **Accepted** 2026-08-30 | — |
| [ADR-036](#adr-036--moderate_content-as-a-platform-action) | `moderate_content` as the 33rd action: platform-only takedown and quarantine, always audited | **Accepted** 2026-08-30 | — |
| [ADR-037](#adr-037--duplicated-tenant-keys-are-protected-by-composite-foreign-keys) | Duplicated tenant keys are protected by composite foreign keys in the database | **Accepted** 2026-08-30 | — |
| [ADR-038](#adr-038--provisional-boundaries-for-the-four-non-blocking-feature-questions) | Provisional implementation boundaries for the four non-blocking feature questions | **Accepted** 2026-08-30 | — |

"Blocks scaffolding" means the first code we write would have to be rewritten if you decide differently. Accepted records show "—" because they are settled. The eight records still marked `Proposed` — ADR-011, ADR-015, ADR-016, ADR-018, ADR-019, ADR-021, ADR-026 and ADR-027 — are non-blocking preferences that can be changed after scaffolding without rework.

## 2. Architecture decision records

### ADR-001 — One shared multi-tenant platform

**Status:** **Accepted 2026-08-30**
**Context:** VenuBoard sells branded sites to many small venues. A tempting shortcut is a template repository or database per customer.
**Decision:** One codebase, one deployment, one PostgreSQL database, many tenants, distinguished by `business_id` / `venue_id`. Per-venue deployments, databases and schemas are prohibited.
**Consequences:** Every improvement reaches all customers at once and operational cost stays flat as the customer count grows. The price is that tenant isolation becomes a security-critical property (see ADR-005) and that noisy-neighbour effects must be watched. Rejected alternatives: schema-per-tenant (migration cost explodes), database-per-tenant (operationally unaffordable at this price point), repository-per-tenant (immediately unmaintainable).

> "One deployment" refers to one application per **environment**. Local, staging and production are separate, isolated deployments of the same codebase — see ADR-034.

### ADR-002 — Modular monolith, not microservices

**Status:** **Accepted 2026-08-30**
**Context:** Eight modules, a small team, and no scale problem yet.
**Decision:** One deployable application with strong internal module boundaries — each module owning its tables, domain logic, permission checks and UI.
**Consequences:** Simple local development, atomic transactions across modules, one deployment to reason about. Boundary discipline must be enforced by review rather than by network separation. Extraction into services remains possible later but is explicitly not a goal.

### ADR-003 — Next.js App Router with TypeScript in strict mode

**Status:** **Accepted 2026-08-30**
**Context:** Three surfaces — public sites needing SEO and mobile speed, plus two admin panels.
**Decision:** Next.js App Router with React Server Components; TypeScript `strict`, with `any` and `Function` types disallowed.
**Consequences:** Server-side data loading keeps tenant scoping and entitlement checks on the server, where they belong, and public pages can be cached per venue. The cost is App Router complexity (caching semantics, Server Actions) that the team must learn properly.

### ADR-004 — Supabase as the managed platform layer

**Status:** **Accepted 2026-08-30**
**Context:** A small team cannot operate PostgreSQL, an auth service, object storage and a realtime layer by hand.
**Decision:** Supabase for managed PostgreSQL, authentication, storage, realtime and Row Level Security.
**Consequences:** Fast start, RLS available as a first-class isolation mechanism, storage policies aligned with database policies. Accepts vendor coupling — mitigated by the fact that the core is standard PostgreSQL and migrations are plain SQL. One Supabase project per environment (ADR-034); the initial region is `ap-southeast-1` (ADR-032).

### ADR-005 — Tenant isolation through RLS *and* application authorisation

**Status:** **Accepted 2026-08-30**
**Context:** In a shared database, one missing `where` clause is a data breach.
**Decision:** Defence in depth. Application authorisation is the primary gate; PostgreSQL RLS is a mandatory backstop on every tenant table. Neither is trusted alone. The service-role key is never used on a request path serving tenant users.
**Consequences:** Slightly more complex queries and a real need to watch policy performance — measured during the first schema implementation rather than left to later (OQ-30). In exchange, a single application bug cannot leak another tenant's data. Isolation tests are mandatory (ADR-017), and the duplicated tenant keys these policies rely on are protected by database constraints (ADR-037).

### ADR-006 — A direct tenant key on every tenant-owned table

**Status:** **Accepted 2026-08-30**
**Context:** RLS policies that resolve tenancy through a chain of joins are slow and easy to get wrong.
**Decision:** Every venue-owned table carries `venue_id` directly; every business-owned table carries `business_id` directly, even where it is derivable. **This includes translation tables** (ADR-028), which each carry `venue_id` rather than relying on a join to their parent row.
**Consequences:** Mild denormalisation, in exchange for simple, fast, auditable policies. The denormalisation is **not** left to careful writes: [ADR-037](#adr-037--duplicated-tenant-keys-are-protected-by-composite-foreign-keys) requires database-level composite foreign keys so a child row cannot claim a different tenant from its parent.

### ADR-007 — Action-based permissions with fixed MVP roles

**Status:** **Accepted 2026-08-30**
**Context:** Role-name checks scattered through feature code become unauditable within weeks.
**Decision:** A named action catalogue plus a single `can(actor, action, scope)` primitive. Roles are bundles of actions. MVP roles are fixed; fully custom roles are a non-goal. **The full action catalogue is accepted**, including the fourteen actions that were previously flagged `(added)` because they closed gaps in the originally specified list. The `(added)` labels have been removed from [roles-and-permissions.md](./roles-and-permissions.md#3-action-catalogue); the record of which actions were additions is preserved in [section 6](#6-decision-history) and in that document's provenance note.
**Consequences:** The permissions matrix is testable cell by cell, and new capabilities are added in one place. Customers wanting bespoke roles must wait; per-venue settings (such as the approval requirement) cover the common cases.
**Catalogue size, and how it got there:** the catalogue accepted in the first round of 2026-08-30 contained **32** actions, not the 33 quoted in an earlier review summary, which miscounted. Review while recording this decision surfaced one genuine gap — platform content moderation was described in the architecture and data model but had no action — so a 33rd action, `moderate_content`, was proposed as OQ-36 and **approved in the second round the same day** ([ADR-036](#adr-036--moderate_content-as-a-platform-action)). **The catalogue is now final at 33 actions**, and the permissions matrix has exactly 33 matching rows.

### ADR-008 — Entitlement and venue configuration are separate concepts

**Status:** **Accepted 2026-08-30**
**Context:** The commercial model depends on venues not being able to switch on what they have not bought.
**Decision:** Two independent records: platform-granted **entitlements** (`venue_module_entitlements`, platform-write-only) and venue-chosen **configuration** (`venue_module_settings`). A module is publicly visible only when entitled **and** enabled. Precedence: per-venue override → trial → add-on → plan, with an explicit deny always winning. The commercial shape is confirmed as **a base plan plus optional modules, trials of individual modules, and platform-controlled per-venue custom overrides**.
**Consequences:** Trials, add-ons, per-venue overrides and expiry windows all become expressible without special cases, and privilege escalation is structurally impossible rather than merely unlikely. Resolution logic must be cached carefully and invalidated on every change. Plan and module definitions live in reference tables, not enum types (ADR-031). **Price points are not part of this decision and remain open (OQ-05).**

### ADR-009 — Public staff data separated from private data, with explicit consent

**Status:** **Accepted 2026-08-30**
**Context:** The staff presence module publishes real people's faces and availability. Mixing that with employment data is both a privacy risk and a reputational one, especially in a nightlife context.
**Decision:** Separate tables (`staff_public_profiles` vs `staff_private_details`), separate RLS policies, no public query path that can reach private data, and recorded, versioned, revocable consent per venue and per consent type.
**Consequences:** Some duplication (a person has a public profile per venue) and an extra consent step in onboarding. In exchange, "public" and "private" are enforced structurally, and withdrawal of consent is immediate and safe. This is also the honest position under Thai PDPA and GDPR, though the legal detail remains open (OQ-03, OQ-04).

### ADR-010 — Structured content only — no custom CSS, JavaScript or HTML

**Status:** **Accepted 2026-08-30**
**Context:** Customers will ask for "just a small tweak" to their site.
**Decision:** Venues supply structured data and choose from approved presentation options. There is no column, field or upload path for CSS, JavaScript or raw HTML anywhere in the model.
**Consequences:** Every public site stays fast, accessible, translatable and safe; a strict Content Security Policy becomes possible; one rendering pipeline serves everyone. Highly bespoke design requests must be answered with new platform features (or declined). This is a deliberate product boundary, not a temporary limitation.

### ADR-011 — Tailwind and shadcn/ui with CSS custom property theming

**Status:** Proposed
**Context:** White-label branding across many venues, built by a small team.
**Decision:** Tailwind CSS with shadcn/ui components vendored into the repository; per-venue branding applied through CSS custom properties derived from stored palette and approved font selections, with an automated contrast check.
**Consequences:** Consistent, accessible components and genuinely per-venue look and feel without any venue-supplied stylesheet. The approved font list must cover Thai script (OQ-27).

### ADR-012 — SQL migrations in the repository, forward-only

**Status:** **Accepted 2026-08-30**
**Context:** Schema changes carry the isolation policies that keep tenants apart.
**Decision:** All schema, RLS policies, `CHECK` constraints, unique and composite foreign-key constraints (ADR-037), reference-table contents, grants and indexes live in reviewed SQL migrations in the repository, applied through CI to every environment in the same order. Nothing is changed by hand in the Supabase dashboard. Database types are generated and committed.
**Consequences:** Reproducible environments and reviewable security changes; discipline required, since dashboard edits are faster in the moment and must be resisted. Reference-table seed content (modules, plans) is migration-managed, distinct from the development/staging demo data of ADR-035. Because integrity constraints are the mechanism that protects duplicated tenant keys, a migration is the only place tenant isolation can be weakened — which makes migration review a security review.

### ADR-013 — Email password and magic link authentication, with MFA support

**Status:** **Accepted 2026-08-30 (amended)**
**Context:** LINE dominates communication in the initial market, but LINE login adds integration work and review overhead. Meanwhile bar staff logging in at 2am on a borrowed phone are badly served by passwords alone, and owners with saved credentials are badly served by magic links alone.
**Decision:** Supabase email authentication supporting **both email + password and email magic links** for the MVP; the user chooses per sign-in. Onboarding remains invitation-based (ADR-014). **MFA must be supported architecturally from the start, and is mandatory for `platform_admin` and `platform_support` accounts before production launch.** LINE-based onboarding remains a later addition, designed for but not built.
**Consequences:** Two sign-in paths to build, test and document, and both must be covered by the end-to-end suite. Magic links become an authentication secret that support sessions must never expose (ADR-022). MFA enrolment and recovery flows must exist for platform accounts before launch, which is a launch-readiness checklist item rather than a scaffolding blocker.
**Supersedes:** the original ADR-013, which proposed a single email method with the choice left open (OQ-09).

### ADR-014 — Invitation-based onboarding

**Status:** **Accepted 2026-08-30 (amended)**
**Context:** Open self-registration into an existing tenant would be a privilege-escalation vector.
**Decision:** Users join a business or venue only through a tokenised, expiring, single-use invitation that carries the target scope and role. Nobody may invite above their own level, and venue-manager invitation rights are off unless the business owner enables them. **Amended:** because there is no public self-service signup in the MVP (ADR-033), the *first* business owner of a new business is always created by the platform operator.
**Consequences:** Tenant membership is always traceable to an inviter, which the audit log records. Onboarding a whole team takes a few more steps than a shared link, which is the correct trade.

### ADR-015 — `next-intl` for English and Thai

**Status:** Proposed
**Context:** Bilingual content is a requirement, not a nicety, in the target market.
**Decision:** `next-intl` for **interface strings** and locale-aware public routing. Venue-authored content is stored in normalised translation tables (ADR-028), not in message catalogues.
**Consequences:** Both languages are first-class from day one. Content authors carry a real translation burden, so the admin UI must make partial translation visible and acceptable rather than blocking.

### ADR-016 — Zod for validation, React Hook Form for complex forms

**Status:** Proposed
**Context:** Untrusted input arrives from public booking forms, admin panels and webhooks.
**Decision:** A Zod schema at every input boundary, reused for TypeScript types; React Hook Form for complex multi-field forms, with simpler forms using plain Server Actions.
**Consequences:** One validation definition serving both runtime and compile time, and no unvalidated boundary. Zod enums for workflow states must be kept consistent with the database `CHECK` constraints (ADR-031).

### ADR-017 — Vitest, Playwright, and mandatory isolation and permission suites

**Status:** **Accepted 2026-08-30**
**Context:** Tenant isolation and permissions are the two failure modes that could end the product.
**Decision:** Vitest for unit and integration tests (integration against a real ephemeral PostgreSQL with RLS active); Playwright for end-to-end. Two suites are mandatory and run on every pull request: **tenant isolation** (per table, per operation, including translation tables, public read paths and storage) and **permissions** (every matrix cell, positive and negative). A new tenant table or action does not merge without them. Tests run against the deterministic seed dataset and fixed test identities of ADR-035, and must include negative tests that attempt cross-venue parent/translation mismatches (ADR-037) and attempts to republish platform-quarantined content (ADR-036).
**Consequences:** Slower pull requests and real test-infrastructure investment before feature work feels productive. This is the single most important quality decision in the document. It also carries the RLS performance obligation: the first schema implementation measures the main RLS-sensitive query paths against representative tenant data before the schema becomes expensive to change (OQ-30).
**History:** proposed 2026-08-29; accepted 2026-08-30 in the second round, alongside the other records that had blocked scaffolding. ADR-035, accepted in the first round, already depended on it.

### ADR-018 — Vercel hosting, with manual custom domains for the MVP

**Status:** Proposed
**Context:** Wildcard subdomains and per-customer custom domains with TLS are the fiddly part of white-label hosting.
**Decision:** Vercel for the application, with a wildcard `*.venuboard.com` for venue subdomains. Custom domains are configured manually in MVP: recorded in `/platform`, DNS pointed by the customer, added at the host by the operator, then marked verified. Automation via the provider API comes later. Separate projects or project scopes per environment (ADR-034).
**Consequences:** Fast start and no DNS automation to build. Operator toil per custom domain, acceptable at low volume and tracked as a scaling item (OQ-20). Staging needs its own hostname scheme that cannot be confused with production (for example a distinct staging apex domain).

### ADR-019 — Manual billing state in the MVP, Stripe later

**Status:** Proposed
**Context:** The first cohort is small, local, and likely to pay by bank transfer or cash.
**Decision:** The subscription model records state, plan, trial dates and retention dates, all managed manually by the operator. Stripe is designed for (`external_billing_ref`, `managed_manually`) but not integrated.
**Consequences:** No payment integration on the critical path to launch; the operator does manual work per customer. Subscriptions are venue-scoped (ADR-030), so a multi-venue business is several manual records until invoice consolidation is built. Pricing itself remains open (OQ-05).

### ADR-020 — Venue routing by subdomain, custom domain, and `/v/[slug]` fallback

**Status:** **Accepted 2026-08-30**
**Context:** Every venue needs a public address immediately, before any domain purchase.
**Decision:** Resolution order — verified custom domain, then `[venue-slug].venuboard.com`, then `/v/[venue-slug]` (used in local development and retained as a permanent fallback). `venues.slug` is globally unique with a reserved-word list.
**Consequences:** A venue is publishable within minutes of creation. Slug changes need redirect handling, and the global uniqueness of slugs is a minor product constraint that the admin UI must explain clearly. Middleware and the domains table are now safe to build.
**History:** proposed 2026-08-29; accepted 2026-08-30.

### ADR-021 — First-party analytics stored in PostgreSQL

**Status:** Proposed
**Context:** The product promise is outcome analytics (direction clicks, LINE clicks, booking conversion), not page-view vanity metrics — and the venues' customers deserve privacy.
**Decision:** First-party event ingest through an internal route, append-only events plus daily rollups in PostgreSQL. No third-party trackers, no advertising pixels, no cross-site identifiers, no raw IP storage.
**Consequences:** Full control, simple stack, privacy-defensible. PostgreSQL becomes the analytics store, which is fine at MVP volume with the documented escape hatch. Retention and consent details remain open (OQ-04, OQ-14). Revenue attribution stays out of scope because reliable revenue data would require POS integration, a non-goal.

### ADR-022 — Support access is read-only by default and session-gated

**Status:** **Accepted 2026-08-30**
**Context:** The operator must be able to help customers without holding a silent, permanent back door into every tenant.
**Decision:** Platform access to tenant data requires an open, labelled support session with a stated reason. Sessions are read-only by default; write access needs a separate confirmation, an expiry and an explicit scope. No mechanism exposes passwords, magic-link tokens or other authentication secrets, and there is no credential-borrowing "log in as". Everything is audited and a persistent banner shows when a session is active.
**Consequences:** Support is slightly slower and considerably more defensible. `/platform` and the audit schema can now be built. Session default duration and customer notification remain open (OQ-16); masking restricted personal data by default remains open (OQ-17); neither blocks the schema, since both are configuration and presentation.
**Relationship to ADR-036:** content takedown is the one deliberate exception to session-gating. It is a destructive-only, always-audited platform action, not a route to tenant data, and it is specified separately.
**History:** proposed 2026-08-29; accepted 2026-08-30.

### ADR-023 — Deactivation rather than destructive deletion

**Status:** **Accepted 2026-08-30**
**Context:** Nightlife staff turnover is high and people frequently return. Deleting a person would orphan bookings, posts and history.
**Decision:** People, memberships and content are deactivated or archived, never hard-deleted in normal operation. Public visibility is removed immediately on deactivation. Open bookings and pending content **must be reassigned before deactivation completes**. Restoration reconnects history but requires consent to be re-confirmed. Hard deletion happens only through retention-policy execution or a legally required erasure request.
**Consequences:** History stays intact and attributed; a returning employee is a two-click restore. Erasure requests need a dedicated path (OQ-01, OQ-03), and deactivation carries a mandatory reassignment step that the UI must handle gracefully. The soft-delete columns and the reassignment gate can now be built into the schema.
**History:** proposed 2026-08-29; accepted 2026-08-30.

### ADR-024 — Booking requests are enquiries, not reservations

**Status:** **Accepted 2026-08-30**
**Context:** Real table inventory demands floor plans, turn times and staff discipline that small bars do not have.
**Decision:** A booking request is a structured enquiry that a human accepts or declines. No inventory model, no tables, no availability engine, no deposits or payments in MVP. Customer contact details are restricted; internal notes are never public.
**Consequences:** Ships quickly, matches how these venues actually work, and cannot double-book because it never claims to book at all. Venues expecting a reservation system must be told plainly what this is. Customer-data retention for concluded bookings remains open (OQ-22) but does not block the schema, since the retention window is configuration.
**History:** proposed 2026-08-29; accepted 2026-08-30.

### ADR-025 — Per-venue content classification with an operator override

**Status:** **Accepted 2026-08-30**
**Context:** The initial market is nightlife, the platform must also serve general-audience venues, and the operator carries the reputational and legal exposure.
**Decision:** Each venue is classified `general` or `nightlife_18_plus`. The venue chooses; the operator can force the higher classification and lock it. Prohibited content (nudity, explicit sexual content, advertising sexual services, illegal content, non-consensual imagery, content involving minors) is banned at every classification level, and content or media can be quarantined by the operator via `moderate_content` (ADR-036).
**Consequences:** Nightlife venues get an appropriate presentation without the platform becoming an adult site. The classification field, the platform lock and the takedown mechanism can now be built. **An age notice is not moderation and not legal compliance** — a moderation *workflow*, acceptable-use policy and takedown *process* are required before launch and remain unresolved (OQ-07, OQ-08), confirmed as launch blockers rather than scaffolding blockers. ADR-036 gives the operator the lever; it does not give them a process.
**History:** proposed 2026-08-29; accepted 2026-08-30.

### ADR-026 — No pinned package versions yet

**Status:** Proposed
**Context:** Documentation written before scaffolding would pin versions that are stale by the time code exists.
**Decision:** Name technologies, not versions. Versions are chosen and locked at scaffolding time, in one place.
**Consequences:** No misleading version claims in the documentation; the scaffolding step must record the chosen versions.

### ADR-027 — Recurring events postponed, with a reserved field

**Status:** Proposed
**Context:** Recurrence (a weekly quiz night) is genuinely useful but disproportionately complex — timezones, exceptions, edits to a single occurrence.
**Decision:** No recurrence engine in MVP. Venues duplicate or copy events. An unused `recurrence_rule` field is reserved so adding recurrence later is additive rather than breaking.
**Consequences:** Some manual work for venues with weekly nights, and a known follow-up feature with a clear migration path.

### ADR-028 — Normalised, entity-specific translation tables

**Status:** **Accepted 2026-08-30**
**Context:** Venue content must exist in English and Thai, frequently partially translated. Three options were on the table: locale-keyed JSON columns, one generic polymorphic translations table, or a translation table per translatable entity.
**Decision:** **A normalised translation table per translatable entity** — `venue_translations`, `post_translations`, `event_translations`, `offer_translations`, and one for each other entity with translatable fields. Each row references its parent entity and a locale, with a uniqueness constraint on (parent, locale) and a direct `venue_id` for RLS (ADR-006). The duplicated `venue_id` is protected by a composite foreign key to the parent, so a translation cannot claim a different venue from the row it translates ([ADR-037](#adr-037--duplicated-tenant-keys-are-protected-by-composite-foreign-keys)). **Locale-keyed JSON fields are rejected. A single generic polymorphic translations table is rejected.**
**Consequences:** Real foreign keys, real per-field `NOT NULL` where wanted, proper indexes, straightforward "which venues lack Thai content" queries, and typed access per entity. The costs are more tables, a join per translatable entity per locale, and translation rows to create alongside every content write. Rejected alternatives: JSON columns cannot be constrained or indexed per field and make partial-translation reporting awkward; a polymorphic table cannot carry foreign keys and forces every field into one untyped column. Resolution order for display stays requested locale → venue default locale → any available locale, and untranslated content is marked honestly rather than machine-translated.
**Resolves:** OQ-10.

### ADR-029 — A 30-day trial grants all MVP modules by default

**Status:** **Accepted 2026-08-30**
**Context:** Trials must demonstrate the product without the operator hand-picking modules for every prospect.
**Decision:** The standard trial is **30 days and grants all MVP modules by default**. The platform operator may configure exclusions for a specific trial, extend a trial, or grant a trial of an individual module independently. Trial grants are ordinary `venue_module_entitlements` rows with `source_key = 'trial'` and an end date, so no separate trial-permission mechanism exists.
**Consequences:** Onboarding step 7 stops being a bottleneck, and a venue can be demonstrated fully from day one. Trial expiry must degrade gracefully — modules disappear from the public site when the entitlement window closes, which the seed dataset must cover (ADR-035) and the admin UI must warn about in advance.
**Resolves:** OQ-06.

### ADR-030 — Subscriptions are venue-scoped

**Status:** **Accepted 2026-08-30**
**Context:** A business may own several venues that open, close, upgrade and fail independently. Billing one subscription for a group makes per-venue suspension incoherent.
**Decision:** **Every subscription is venue-scoped.** Each venue has its own subscription state, entitlements, storage quota and billing records. A multi-venue business owner sees a **combined overview** derived from its venues' subscriptions, but the overview holds no state of its own. Invoice consolidation may be added later; it is not part of the MVP.
**Consequences:** Suspending one under-performing venue never affects its siblings, which matches the requirement that each venue keeps independent billing state. `subscriptions.venue_id` becomes mandatory and the nullable business-level variant is removed from the model. A "business trial" is expressed as the operator starting trials on all of that business's venues in one action, with the state still living per venue. The operator does more per-venue bookkeeping until consolidation exists (OQ-39).
**Resolves:** OQ-12.

### ADR-031 — No PostgreSQL enum types

**Status:** **Accepted 2026-08-30**
**Context:** Controlled vocabularies appear throughout the schema. PostgreSQL enum types are strict and fast but painful to alter, and they conflate stable internal states with evolving commercial concepts.
**Decision:** **No PostgreSQL enum types anywhere.** Instead:

- **Text columns with `CHECK` constraints** for stable internal workflow states — content states, booking states, presence state, account status, subscription state, support-session mode, locale codes, and similar.
- **Reference tables** for configurable or commercial concepts — modules, plans, entitlement definitions and sources, and anything the operator may extend without a schema change.
- **TypeScript types** generated from, or maintained consistently with, the database constraints, so the two cannot silently diverge.

**Consequences:** Adding a workflow state is a migration that alters one `CHECK` constraint, not an enum type mutation with dependency fallout. Commercial vocabulary becomes data the operator can extend. The cost is that text columns are marginally larger and that consistency between the database constraints, the Zod schemas (ADR-016) and the generated TypeScript types must be actively maintained and tested.
**Resolves:** OQ-11.

### ADR-032 — Supabase region `ap-southeast-1` (AWS Singapore)

**Status:** **Accepted 2026-08-30**
**Context:** The initial customers and their visitors are in Thailand. Latency to the database dominates perceived admin-panel speed.
**Decision:** The initial Supabase projects use **AWS `ap-southeast-1` (Singapore)**.
**Consequences:** Good latency for Thailand and Southeast Asia generally. **This decision controls where primary data is located; it does not by itself demonstrate PDPA compliance.** Lawful basis, notices, data-subject rights, cross-border transfer analysis and processor agreements are separate obligations that remain open (OQ-04). Moving region later means a migration, so this is treated as a durable choice.
**Resolves:** OQ-19 (region only).

### ADR-033 — Operator-led onboarding, no self-service signup in the MVP

**Status:** **Accepted 2026-08-30**
**Context:** The first cohort is a small number of local venues that will be sold to and set up in person. A public signup funnel would add abuse surface, billing automation pressure and support load for no first-release benefit.
**Decision:** **Trials are not self-service in the MVP.** Businesses and venues are created and onboarded by the VenuBoard platform operator, who also creates the first business owner account and starts the trial. A public self-service signup path is **not required for the first release**.
**Consequences:** No public registration route to secure, rate-limit or moderate, and every tenant starts with a human conversation — which suits a market where trust matters. The operator is a bottleneck on growth, so a self-service path is a likely early follow-up. `/platform` must therefore contain a genuinely good business-and-venue creation flow, not an afterthought, because it is the only way a customer can exist.
**Resolves:** OQ-32.

### ADR-034 — Three fully isolated environments: local, staging, production

**Status:** **Accepted 2026-08-30**
**Context:** A multi-tenant platform holding customer and staff personal data cannot be developed against production, and a shared "dev/prod" Supabase project is how personal data leaks into test fixtures.
**Decision:** **Completely separate local, staging and production environments.**

- **Local** — a local Supabase stack with resettable seed data (ADR-035).
- **Staging** — a dedicated hosted Supabase project and a dedicated staging deployment. **A permanent staging environment is required before production launch.**
- **Production** — its own Supabase project and production deployment.

Rules that follow:

- Authentication users, databases, storage buckets, secrets and external-service configuration are **isolated between environments**; nothing is shared.
- **Production customer data is never copied into staging** or into any local environment, in whole or in part.
- The **environment identifier is explicit** — a required configuration value surfaced in the application and visible in the interface for non-production environments.
- **Destructive development or seed commands refuse to run when the environment is production**, checked at runtime rather than by convention.
- **Pull-request preview deployments may be added but must never receive production credentials.**

**Consequences:** Three sets of secrets, projects and migrations to keep in step, and staging needs its own realistic data (which is exactly what ADR-035 provides). In exchange, no test run can touch customer data, and no accidental reset can destroy production. Where preview deployments point remains open (OQ-38).

### ADR-035 — Deterministic, repeatable seed data and fixed test identities

**Status:** **Accepted 2026-08-30**
**Context:** Tenant isolation, permissions, entitlements and lifecycle states can only be tested against data that actually contains the awkward cases. Ad-hoc hand-made fixtures drift, and randomised fixtures make failures irreproducible.
**Decision:** The application includes a **deterministic, repeatable seed dataset** for local and staging use, plus **fixed automated-test identities for every role**. The dataset must cover independent and multi-venue businesses; general-audience and 18+ venues; differing branding and module configurations; every subscription and trial state; storage-quota boundaries; every fixed role; multi-business and multi-venue memberships; staff presence, deactivation and restoration; every content workflow state; English, Thai and deliberately partially translated content; events, bookings, offers and atmosphere states; support sessions and audit records; and explicit permission-denied and tenant-isolation scenarios. All names, images, email addresses and contact details are **fictional**; genuine customer or staff information is never included. Seeding is deterministic (fixed identifiers and timestamps relative to a seed epoch) so tests can assert on it. Test credentials and secrets come from **environment variables or secure test configuration and are never committed**. A **safe reset-and-seed workflow** exists for local and staging and refuses to run against production (ADR-034).
**Consequences:** Real up-front effort to build and maintain the dataset, and it must be updated whenever a state or role is added. In exchange, the isolation and permission suites become meaningful, staging demos are realistic without touching customer data, and a new developer gets a working, interesting database in one command. Which fictional brands and placeholder image sources to use remains open (OQ-37).

### ADR-036 — `moderate_content` as a platform action

**Status:** **Accepted 2026-08-30**
**Context:** Prohibited content will eventually be published by a venue, and the operator carries the legal and reputational exposure. Waiting to open a support session before taking illegal content down is the wrong trade, but a platform action that can *write* tenant content would undermine the whole support model.
**Decision:** `moderate_content` is accepted as the **33rd action** in the catalogue, with these rules:

- It is a **platform action**. `platform_admin` holds it; **`platform_support` does not receive it by default**.
- A platform administrator may **quarantine or unpublish public content without entering a tenant support session**, because a takedown may be urgent and reveals nothing that browsing the public site would not.
- It is **destructive-only**. It cannot create content, rewrite content, publish content, or act as a venue author. There is no path from this action to authoring.
- **Every moderation action requires a reason.** A takedown without a stated reason is rejected.
- Every action records the **acting platform user, the venue, the affected resource, the previous state, the resulting state, the reason, and the timestamp**.
- The action **preserves the original content and associated evidence** unless deletion is legally required, so a dispute or a legal request can still be answered.
- **Restoring quarantined content is equally audited.**
- **Venue users cannot bypass a quarantine by republishing the same record.** Quarantine is enforced as a precondition of publication in the database, not merely hidden in the interface.
- **Dedicated moderator roles remain out of scope.** Moderation authority stays with `platform_admin` in the MVP.

**Consequences:** Urgent takedowns become possible in seconds and are fully accountable. The audit trail distinguishes a takedown from ordinary support activity, which matters if a venue disputes one. The cost is a quarantine flag on every publishable entity plus a publication precondition, and a moderation audit table — a small schema addition that must not be retro-fitted later, because a quarantine that the venue can republish around is worse than none. This action is an **enforcement lever, not a moderation process**: who reviews reports, on what timescale, against which policy, remains open (OQ-07, OQ-08).
**Resolves:** OQ-36.

### ADR-037 — Duplicated tenant keys are protected by composite foreign keys

**Status:** **Accepted 2026-08-30**
**Context:** ADR-006 puts a direct `venue_id` on every tenant-owned table, including translation tables, so RLS policies stay simple and fast. That denormalisation creates a real hazard: a child row could carry a `venue_id` that disagrees with its parent's. A translation row claiming venue B while pointing at venue A's post would be readable by the wrong tenant under a policy that only checks `venue_id` — a cross-tenant leak produced by a single bad insert.
**Decision:** **The database, not the application, prevents a duplicated tenant key from disagreeing with its parent.** For every tenant-owned translated parent:

- The parent carries a **unique key covering `(id, venue_id)`**, in addition to its primary key on `id`.
- The translation table uses a **composite foreign key from `(parent_id, venue_id)` to the parent's `(id, venue_id)`**.
- A translation row is therefore **structurally unable to claim a different venue from its parent**.
- Both the parent relationship and **`(parent_id, locale)` uniqueness** are enforced by database constraints.
- Tests **attempt and must be rejected** on cross-venue parent/translation mismatches.

**The same principle applies wherever any child table duplicates a tenant key for direct RLS** — media rows, post media, event media, presence records, booking events, offer redemptions, cross-promotions — not only to translations. **Application validation alone is never sufficient.**
**Consequences:** A cross-tenant mismatch becomes impossible to insert rather than merely unlikely, and the guarantee survives bugs, ad-hoc SQL, future contributors and any code path that forgets to check. The costs are one extra unique index per translated parent, slightly more verbose foreign keys, and the discipline that adding a tenant-keyed child table means adding its composite key in the same migration. Cheap insurance against the one failure mode that would end the product.

### ADR-038 — Provisional boundaries for the four non-blocking feature questions

**Status:** **Accepted 2026-08-30**
**Context:** Four feature-specific questions are genuinely undecided but were being treated as though they gated the scaffold. Each has a safe default that lets the first build proceed honestly without pre-empting the decision.
**Decision:** Record these as **provisional implementation boundaries**, not as answers:

| Question | Provisional boundary for the initial scaffold |
| --- | --- |
| **OQ-18** — production transactional-email provider | **No production email integration is required in the initial scaffold.** Invitations and magic links are developed against a local mail catcher or logged transport behind a provider-agnostic interface, so the eventual provider is a configuration change |
| **OQ-27** — approved font list | **Use a minimal system-font fallback** until the approved list is selected. The `font_key` field and the approved-list mechanism are built; the list itself starts with the system stack |
| **OQ-38** — preview-deployment data target | **Pull-request previews must never receive production credentials**, and **database-changing preview deployments are not enabled** until an isolated preview-data strategy is accepted. Read-only or build-only previews are acceptable in the meantime |
| **OQ-40** — MFA enrolment and recovery | **MFA is represented in the architecture** and in the schema from the start; **final enrolment and recovery flows remain a pre-production security decision** |

**Consequences:** The scaffold can be built end to end without waiting on a provider contract, a typographic decision, a preview-data design or an MFA flow, and none of the four is quietly assumed. Each boundary is deliberately the conservative option: no live email, no branded fonts, no preview database writes, no half-designed MFA recovery. All four questions stay open in [section 3](#3-open-questions) and must be closed before the features they gate go live.

## 3. Open questions

### 3.1 Legal, policy and privacy — **launch blockers, not scaffolding blockers**

Confirmed on 2026-08-30: none of these prevent application scaffolding, and all of them must be resolved with appropriate professional advice before production launch.

| ID | Question | Why it matters | Needs |
| --- | --- | --- | --- |
| **OQ-01** | What are the exact data-retention durations after cancellation, before scheduled deletion, and for final deletion or anonymisation? | Drives `subscriptions.delete_after`, the deletion job, and customer promises | **Policy + legal decision. Confirmed still unresolved on 2026-08-30. Durations stay configurable; no production deletion schedule is defined and none may be invented by the build.** |
| **OQ-02** | How long are the warning, restricted and suspended periods in the subscription lifecycle? | Determines when a paying customer's public site goes dark | Commercial + policy decision. **Confirmed still unresolved; values remain configurable.** |
| **OQ-03** | Privacy policy, terms of service, data-processing agreement, acceptable-use policy and retention schedule — who drafts them and when? | Required before production launch; none exist today | Legal counsel |
| **OQ-04** | What exactly does Thai PDPA (and GDPR for EU visitors) require of us for analytics, cookies/consent, staff photos and booking data? | Shapes the analytics design, consent UI and staff-consent wording. **Choosing `ap-southeast-1` (ADR-032) does not answer this** | Legal counsel familiar with PDPA |
| **OQ-05** | **Price points** for the base plan and optional modules | Structure is settled (ADR-008); the amounts are not. Plans can be seeded with null prices until decided | Commercial decision. **No amount is assumed anywhere in these documents** |
| **OQ-07** | What is the content moderation and takedown workflow, and who staffs it? | Prohibited content will be uploaded; classification alone is not moderation | Operator policy + resourcing |
| **OQ-08** | Do Thai (or other target-market) rules impose specific requirements on 18+ notices, age assurance, or alcohol advertising? | Affects the age-notice implementation and whether a click-through is even sufficient | Legal counsel |
| **OQ-15** | How much of the audit log may a business owner see, and does that include support sessions? | Transparency versus leaking platform-internal detail | Product + policy |
| **OQ-16** | Default support-session duration, and are customers notified when one starts? | Trust posture toward customers | Product + policy |
| **OQ-22** | How long are booking customers' contact details retained after a booking concludes? | Personal data of non-users; smallest defensible window is likely correct | Policy + legal |
| **OQ-31** | Can venue material be used in VenuBoard marketing, and how is that permission captured? | Stated as requiring permission; the mechanism does not exist yet | Legal + product |

### 3.2 Product and commercial

| ID | Question | Notes |
| --- | --- | --- |
| **OQ-17** | Should restricted personal data (private staff details, booking customer details) be masked by default with an audited reveal? | Proposed yes; adds friction for legitimate use. Needs your call |
| **OQ-21** | Should staff presence auto-expire by default, and at what time (venue closing time? fixed hours?) | Stale "in today" overnight is worse than no data. Currently modelled as optional |
| **OQ-24** | Should a staff member see their own public-profile view metrics, and should managers see per-person figures at all? | Aggregate-only is the privacy-safe default; per-person data invites misuse |
| **OQ-27** | Which fonts are on the approved list? All must have Thai coverage | **Non-blocking.** Provisional boundary ([ADR-038](#adr-038--provisional-boundaries-for-the-four-non-blocking-feature-questions)): a minimal system-font fallback until the list is selected. The `font_key` field and approved-list mechanism are built regardless |
| **OQ-28** | Which social embeds are actually reliable and permitted by each platform's terms? | No design may depend on API feed ingestion. Needs verification per platform, not assumption |
| **OQ-33** | What are the target values for the success signals in the product brief? | Currently listed without targets |
| **OQ-34** | Terminology: is "business" the right customer-facing word in English and Thai, for both single-venue owners and groups? | Affects the entire UI vocabulary and translations |
| **OQ-37** | Which fictional venue names, brands and placeholder image sources does the seed dataset use? | Must be plainly fictional and must not resemble real venues in the target cities (ADR-035). Does not block the scaffold: the dataset's *shape* is specified, only the invented names are outstanding |
| **OQ-39** | When is invoice consolidation for multi-venue businesses built? | Deferred by ADR-030; operator bookkeeping grows linearly with venues until then |

### 3.3 Technical

| ID | Question | Notes |
| --- | --- | --- |
| **OQ-13** | Video: stored in Supabase Storage with size caps, or delegated to an external provider? | Storage cost, bandwidth and transcoding |
| **OQ-14** | Analytics raw-event retention and rollup granularity | Interacts with OQ-01 and OQ-04 |
| **OQ-18** | Which transactional email provider, and what deliverability setup per custom domain? | **Non-blocking.** Provisional boundary ([ADR-038](#adr-038--provisional-boundaries-for-the-four-non-blocking-feature-questions)): **no production email integration in the initial scaffold** — a local mail catcher or logged transport behind a provider-agnostic interface. Needed before invitations or magic links actually send, and configured separately per environment (ADR-034) |
| **OQ-20** | When do we automate custom-domain provisioning, and at what customer count does manual become untenable? | Operator toil threshold |
| **OQ-23** | What are the concrete public-site performance budgets on a mid-range Android phone on mobile data? | Needs numbers to be enforceable in CI |
| **OQ-25** | Error tracking, uptime and per-domain monitoring tooling | Needed before the first paying customer; must be configured per environment |
| **OQ-26** | How often is a backup restore actually rehearsed? | An unrehearsed backup is a hope, not a backup. Staging is the natural rehearsal target, but **never with production data** (ADR-034) |
| **OQ-29** | Is Supabase Realtime used in MVP for presence and atmosphere, or is short-lived caching sufficient? | Currently documented as optional |
| **OQ-30** | Do the RLS helper functions and policies perform acceptably with realistic data volumes? | **Not a scaffolding blocker — an early implementation validation.** The first schema implementation must load representative tenant data and **measure the main RLS-sensitive query paths before the schema becomes expensive to change**: public venue page reads, translation joins, membership resolution, entitlement resolution, and admin list views. Findings may change indexes and helper-function shape, which is exactly why it happens early rather than after feature work |
| **OQ-38** | Are pull-request preview deployments used, and which database do they target — the staging project, or an ephemeral per-branch database? | **Non-blocking.** Provisional boundary ([ADR-038](#adr-038--provisional-boundaries-for-the-four-non-blocking-feature-questions)): previews **never receive production credentials**, and **database-changing previews stay disabled** until an isolated preview-data strategy is accepted |
| **OQ-40** | How are MFA enrolment and account-recovery flows handled for platform accounts, and which factor types are supported? | **Non-blocking.** Provisional boundary ([ADR-038](#adr-038--provisional-boundaries-for-the-four-non-blocking-feature-questions)): MFA is **represented in the architecture and schema** from the start; final enrolment and recovery flows are a **pre-production security decision**. ADR-013 makes MFA mandatory for platform accounts before launch |

### 3.4 Resolved questions

Kept here as an audit trail. Each entry names the record that resolved it.

| ID | Question | Resolved by | Resolution |
| --- | --- | --- | --- |
| **OQ-06** | Which modules does a 30-day trial grant by default? | [ADR-029](#adr-029--a-30-day-trial-grants-all-mvp-modules-by-default) 2026-08-30 | All MVP modules by default; operator may configure exclusions, extend, or grant single-module trials |
| **OQ-09** | Magic link, email + password, or both? MFA for platform accounts? | [ADR-013](#adr-013--email-password-and-magic-link-authentication-with-mfa-support) 2026-08-30 | Both methods in MVP. MFA supported architecturally, mandatory for platform accounts before launch. Mechanics remain open as OQ-40 |
| **OQ-10** | Locale-keyed JSON fields, or a translations table? | [ADR-028](#adr-028--normalised-entity-specific-translation-tables) 2026-08-30 | Normalised, entity-specific translation tables. JSON fields and a generic polymorphic table both rejected |
| **OQ-11** | PostgreSQL enum types or lookup tables? | [ADR-031](#adr-031--no-postgresql-enum-types) 2026-08-30 | Neither enum types nor a single approach: text + `CHECK` for stable workflow states, reference tables for commercial concepts |
| **OQ-12** | Business-scoped subscriptions with venue line items, or venue-scoped rows? | [ADR-030](#adr-030--subscriptions-are-venue-scoped) 2026-08-30 | Venue-scoped, with a derived business overview. Invoice consolidation deferred (now OQ-39) |
| **OQ-19** | Which Supabase region? | [ADR-032](#adr-032--supabase-region-ap-southeast-1-aws-singapore) 2026-08-30 | AWS `ap-southeast-1` (Singapore). Region choice only — PDPA compliance remains OQ-04 |
| **OQ-32** | Should trials be self-service? | [ADR-033](#adr-033--operator-led-onboarding-no-self-service-signup-in-the-mvp) 2026-08-30 | No. Operator-led onboarding; no public signup path in the first release |
| **OQ-35** | Are the actions added beyond the original list correct? | [ADR-007](#adr-007--action-based-permissions-with-fixed-mvp-roles) 2026-08-30 | The catalogue is accepted, `(added)` labels removed and their provenance preserved. The one newly identified gap was then closed by OQ-36 below |
| **OQ-36** | Confirm `moderate_content` as the 33rd action | [ADR-036](#adr-036--moderate_content-as-a-platform-action) 2026-08-30 | Approved. Platform-only, destructive-only, no support session required, reason mandatory, fully audited, content preserved, restores audited, and venue users cannot republish around a quarantine. Dedicated moderator roles stay out of scope. **The catalogue and matrix now contain exactly 33 matching actions** |

Two questions from the first revision were **partially** resolved and remain open in narrowed form: OQ-05 (plan *structure* settled by ADR-008; **price points** still open) and OQ-04 (data *location* settled by ADR-032; **compliance obligations** still open).

## 4. Decisions needed before application scaffolding

**None. Nothing in this register blocks initial application scaffolding.**

Every record that was marked as blocking has been accepted, and the one blocking open question has been resolved:

| Previously blocking | Now |
| --- | --- |
| ADR-001 to ADR-010 | **Accepted** 2026-08-30, first round |
| ADR-013, ADR-014 | **Accepted** 2026-08-30, first round, both amended |
| ADR-012, ADR-017, ADR-020, ADR-022, ADR-023, ADR-024, ADR-025 | **Accepted** 2026-08-30, second round |
| OQ-06, OQ-09, OQ-10, OQ-11, OQ-12, OQ-19, OQ-32, OQ-35 | **Resolved** — see [section 3.4](#34-resolved-questions) |
| OQ-36 — `moderate_content` | **Resolved** by [ADR-036](#adr-036--moderate_content-as-a-platform-action). Catalogue and matrix now hold exactly 33 matching actions |

The eight records still marked `Proposed` (ADR-011, ADR-015, ADR-016, ADR-018, ADR-019, ADR-021, ADR-026, ADR-027) are non-blocking preferences: changing any of them later is a refactor, not a rewrite.

### 4.1 Obligations on the first implementation

These constrain how the scaffold is built; none of them prevents starting it.

1. **Measure RLS performance early (OQ-30).** The first schema implementation loads representative tenant data and measures the main RLS-sensitive query paths — public venue page reads, translation joins, membership resolution, entitlement resolution, admin list views — **before the schema becomes expensive to change**.
2. **Ship the tenant-integrity constraints with the tables that need them ([ADR-037](#adr-037--duplicated-tenant-keys-are-protected-by-composite-foreign-keys)).** A composite key added now is free; added later it is a migration against live data with existing violations to clean up.
3. **Ship the quarantine precondition with the publishable entities ([ADR-036](#adr-036--moderate_content-as-a-platform-action)).** A quarantine a venue can republish around is worse than no quarantine.
4. **Respect the four provisional boundaries ([ADR-038](#adr-038--provisional-boundaries-for-the-four-non-blocking-feature-questions))** rather than quietly inventing answers to OQ-18, OQ-27, OQ-38 and OQ-40.

### 4.2 Launch blockers — required before production, not before code

Every item in [section 3.1](#31-legal-policy-and-privacy--launch-blockers-not-scaffolding-blockers), all needing appropriate professional advice: retention and account-lifecycle durations (OQ-01, OQ-02), the legal documentation set (OQ-03), PDPA and GDPR obligations (OQ-04), price points (OQ-05), the **moderation and takedown process** (OQ-07 — ADR-036 supplies the lever, not the process), Thailand's 18+ and alcohol-advertising rules (OQ-08), audit visibility to customers (OQ-15), support-session transparency (OQ-16) and booking-data retention (OQ-22), plus marketing permission (OQ-31).

Operational launch-readiness items alongside them: MFA enrolment and recovery for platform accounts (OQ-40), a live transactional-email provider (OQ-18), error and uptime monitoring (OQ-25), a **rehearsed** backup restore (OQ-26), and a permanent staging environment ([ADR-034](#adr-034--three-fully-isolated-environments-local-staging-production)).

### 4.3 Feature-specific decisions — required before the feature, not before the scaffold

OQ-13 (video storage), OQ-14 (analytics retention), OQ-17 (masking restricted personal data), OQ-20 (domain provisioning automation), OQ-21 (presence auto-expiry), OQ-23 (performance budgets), OQ-24 (staff-profile metrics), OQ-27 (approved font list), OQ-28 (social embeds), OQ-29 (Realtime), OQ-33 (success targets), OQ-34 (customer-facing terminology), OQ-37 (seed-data fictional names), OQ-38 (preview-deployment data target) and OQ-39 (invoice consolidation).

Each gates one feature or one polish pass. Four carry recorded provisional boundaries (OQ-18, OQ-27, OQ-38, OQ-40); the rest have a documented safe default or affect only work that has not started.

OQ-18 and OQ-40 appear in [4.2](#42-launch-blockers--required-before-production-not-before-code) as well as here, deliberately: a live email provider and MFA enrolment each gate a feature *and* gate going live. Every other question belongs to exactly one list, and OQ-30 sits in [4.1](#41-obligations-on-the-first-implementation) because it is work the first implementation must do rather than a decision anyone owes.

## 5. How to use this document

- Each ADR moves from `Proposed` to `Accepted` (with a date) or `Rejected` (with the reason and the alternative chosen). Superseded ADRs are kept and marked, never deleted.
- Each OQ is closed by either a new ADR or a recorded policy decision, and then moves to [Resolved questions](#34-resolved-questions) with a link to what closed it. **OQ identifiers are never reused or renumbered.**
- If a question is answered in conversation rather than in this file, it is **not yet decided**. Write it down here first.
- Every revision adds an entry to the decision history below.

## 6. Decision history

### 2026-08-30 — Second acceptance round

**Effect: nothing in this register blocks initial application scaffolding.**

**Accepted:** the seven remaining blocking records — ADR-012, ADR-017, ADR-020, ADR-022, ADR-023, ADR-024, ADR-025 — with their original context, decisions and consequences preserved and a `History:` line added to each. New records ADR-036, ADR-037 and ADR-038.

**Resolved:** OQ-36. `moderate_content` is approved as the 33rd action, and the catalogue and the permissions matrix now contain exactly 33 matching entries.

**Substantive changes to the documentation:**

| Change | Records | Effect on the docs |
| --- | --- | --- |
| `moderate_content` approved: platform-only, destructive-only, no support session required, reason mandatory, fully audited, content preserved, restores audited, republication blocked | ADR-036 | The action loses its "pending" marker in [roles-and-permissions.md](./roles-and-permissions.md) and gains a rules subsection. [data-model.md](./data-model.md) gains platform quarantine columns on publishable entities, a publication precondition, and the `moderation_actions` audit table |
| Duplicated tenant keys are protected by composite foreign keys | ADR-037 | [data-model.md](./data-model.md) documents `UNIQUE (id, venue_id)` on translated parents, composite `(parent_id, venue_id)` foreign keys, `(parent_id, locale)` uniqueness, and extends the rule to every child table that duplicates a tenant key. Isolation tests must attempt and be rejected on cross-venue mismatches |
| Four feature questions given provisional boundaries instead of blocking status | ADR-038 | OQ-18, OQ-27, OQ-38 and OQ-40 are marked non-blocking with their boundaries recorded, and the boundaries appear in the architecture where they affect the build |
| RLS performance reclassified | OQ-30 | No longer described as a spike gating the schema; now an obligation on the first implementation, which must measure the RLS-sensitive query paths against representative data early |
| Section 4 rewritten | — | "Decisions needed before scaffolding" becomes an explicit "none", with launch blockers ([4.2](#42-launch-blockers--required-before-production-not-before-code)) and feature-specific decisions ([4.3](#43-feature-specific-decisions--required-before-the-feature-not-before-the-scaffold)) separated |

**Reaffirmed as unresolved:** OQ-01, OQ-02 and OQ-05 remain open with no durations or price points assumed anywhere. Section 3.1 remains a set of launch blockers requiring professional advice. ADR-036 deliberately does **not** resolve OQ-07: it supplies the takedown mechanism, not the moderation process.

**New questions raised by this round:** none.

### 2026-08-30 — First acceptance round

**Accepted:** ADR-001 to ADR-010 without amendment. ADR-013 and ADR-014 with amendments. New records ADR-028 to ADR-035.

**Substantive changes to the documentation:**

| Change | Records | Effect on the docs |
| --- | --- | --- |
| Multilingual content moves to normalised, entity-specific translation tables | ADR-028 | Every `(localised)` field annotation in [data-model.md](./data-model.md) is replaced by a named translation table. Locale-keyed JSON and a generic polymorphic table are recorded as rejected |
| Both password and magic-link sign-in; MFA architecturally supported and mandatory for platform accounts before launch | ADR-013 | Stack table, `/platform` hardening, support-secrets rule, and the account-lifecycle section updated |
| Full action catalogue accepted; `(added)` labels removed | ADR-007 | The fourteen actions previously flagged `(added)` are now ordinary catalogue entries. Their provenance is preserved in the note below and in the roles document |
| Trial grants all MVP modules for 30 days | ADR-029 | Onboarding step 7 is no longer a bottleneck; the brief and entitlement sections updated |
| Subscriptions become venue-scoped | ADR-030 | `subscriptions.venue_id` is mandatory; the nullable business-level subscription is removed; a derived business overview replaces it |
| No PostgreSQL enum types | ADR-031 | The "Enumerations" section of the data model becomes "Controlled vocabularies", split into `CHECK`-constrained text columns and reference tables |
| Region fixed to `ap-southeast-1` | ADR-032 | Hosting section states the region and explicitly separates it from PDPA compliance |
| No self-service signup in MVP | ADR-033 | Operator-led onboarding throughout; the self-serve sign-up path is removed from the invitation rules and added to the first-release non-goals |
| Three isolated environments | ADR-034 | The environments section of the architecture is rewritten with isolation rules, explicit environment identifiers and production guards |
| Deterministic seed data and fixed test identities | ADR-035 | New seed-data sections in the architecture and data model; testing strategy updated |

**Provenance of the accepted action catalogue.** The original product requirements named 18 actions. Fourteen were added during design to close gaps: `view_booking_customer_details`, `manage_atmosphere`, `manage_offers`, `manage_own_public_profile`, `toggle_own_presence`, `manage_own_consent`, `submit_content_for_approval`, `manage_venue_domains`, `manage_notification_preferences`, `view_audit_log`, `manage_platform_tenants`, `start_support_session`, `grant_support_write_access`, `manage_platform_users`. All fourteen are accepted; that is 32 actions in total. A fifteenth addition, `moderate_content`, was identified while recording this decision and raised as OQ-36; it was **approved in the second round later the same day** ([ADR-036](#adr-036--moderate_content-as-a-platform-action)), bringing the catalogue to its final 33.

**Reaffirmed as unresolved:** OQ-01 and OQ-02 (all retention, warning, restriction, suspension and deletion durations remain configurable and undecided; no production deletion schedule is defined) and OQ-05 (price points). Confirmed as launch blockers rather than scaffolding blockers: OQ-03, OQ-04, OQ-07, OQ-08, OQ-22, OQ-31.

**New questions raised by this round:** OQ-36 (`moderate_content`), OQ-37 (seed-data fictional identities), OQ-38 (preview-deployment target), OQ-39 (invoice consolidation), OQ-40 (MFA mechanics).

### 2026-08-29 — Initial documentation

Initial product and technical documentation created: product brief, architecture, roles and permissions, data model, and this register with ADR-001 to ADR-027 all `Proposed` and OQ-01 to OQ-35 open.
