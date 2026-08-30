# VenuBoard

**A modular, multi-tenant, white-label website and management platform for venues.**

> **Repository status: documentation only.** No application has been scaffolded, no packages installed, no production code written. This repository currently contains the product and technical documentation.
>
> **Decision status (2026-08-30): documentation complete. Nothing blocks application scaffolding.** All decisions that gated the first code are accepted — ADR-001 to ADR-010, ADR-012 to ADR-014, ADR-017, ADR-020, ADR-022 to ADR-025, and the newer ADR-028 to ADR-038 — and the 33-action permissions catalogue is final. The records still marked proposed are non-blocking preferences. What remains is split into [launch blockers](./docs/decisions-and-open-questions.md#42-launch-blockers--required-before-production-not-before-code) (legal, policy, retention, pricing) and [feature-specific decisions](./docs/decisions-and-open-questions.md#43-feature-specific-decisions--required-before-the-feature-not-before-the-scaffold).

---

## What VenuBoard is

VenuBoard gives each subscribing venue three things:

1. A **branded public-facing website** on its own subdomain (`[venue-slug].venuboard.com`), optionally on its own custom domain.
2. A **venue administration panel** (`/admin`) for owners, managers, editors and staff.
3. A set of **optional modules** switched on by the venue's subscription and entitlements.

The VenuBoard operator runs a separate **platform administration panel** (`/platform`) for customers, businesses, venues, subscriptions, trials, entitlements, support access and platform operations.

**Initial market:** small-to-medium independent bars in Thailand, especially nightlife destinations such as Pattaya, Phuket, Patong and Koh Samui.

**Deliberate expansion path:** larger clubs, hospitality groups, restaurants, entertainment venues and other venue types. Nothing in the architecture is restricted to bars or to adult nightlife.

## Documentation

| Document | What it covers |
| --- | --- |
| [docs/product-brief.md](./docs/product-brief.md) | Product scope: market, surfaces, MVP modules, entitlements, lifecycle policies, analytics, onboarding, non-goals, data ownership |
| [docs/architecture.md](./docs/architecture.md) | Technical architecture, system context diagram, stack, module structure, routing, tenant isolation, internationalisation, testing, environments and hosting |
| [docs/roles-and-permissions.md](./docs/roles-and-permissions.md) | Role catalogue, the 33 actions, the permissions matrix, support and impersonation model, content moderation rules, public/private data access |
| [docs/data-model.md](./docs/data-model.md) | Tenant hierarchy, entity relationships, module tables, translation tables, tenant-key integrity constraints, controlled vocabularies, Row Level Security patterns, moderation and quarantine, seed data, retention |
| [docs/decisions-and-open-questions.md](./docs/decisions-and-open-questions.md) | Architecture decision records, the dated decision history, and every unresolved legal, policy, pricing, retention and technical question |

**Start here:** [product brief](./docs/product-brief.md) → [architecture](./docs/architecture.md) → [decisions and open questions](./docs/decisions-and-open-questions.md).

## Core architecture principles

- **One shared multi-tenant platform.** One codebase, one deployment per environment, one PostgreSQL database per environment, many tenants. No per-venue deployment, database or fork.
- **Hierarchy:** platform → business → venue, with users joined through business memberships and venue memberships. A business may own many venues; a user may belong to many businesses and venues with a different role in each.
- **Venue independence.** Each venue keeps its own branding, modules, content, configuration, analytics, **subscription** and public presence, even when venues share a business.
- **Tenant isolation is a security requirement.** Enforced by PostgreSQL Row Level Security **and** application-level authorisation, with a mandatory automated isolation test suite.
- **Modular monolith**, not microservices.
- **Entitlement ≠ configuration.** The platform operator grants modules; the venue chooses whether an entitled module is enabled and publicly visible. A venue can never grant itself a module it has not been given.
- **Structured content only.** No custom CSS, no custom JavaScript, no arbitrary code injection.
- **Three isolated environments.** Local, staging and production share nothing, and production customer data is never copied into staging or local.
- **Isolation is enforced by constraints, not conventions.** Where a table duplicates its parent's tenant key for fast Row Level Security, a composite foreign key makes disagreeing with the parent impossible rather than merely unlikely.

## Proposed stack

Next.js (App Router) · TypeScript (strict) · React · Tailwind CSS · shadcn/ui · PostgreSQL with no enum types (text + `CHECK` constraints and reference tables) · Supabase (managed PostgreSQL, auth, storage, realtime, Row Level Security) in `ap-southeast-1` · SQL migrations in-repository · email auth with **both password and magic link**, plus MFA support · invitation-based, operator-led onboarding · `next-intl` for interface strings with **normalised translation tables** for venue content (English + Thai) · Zod · React Hook Form · Vitest · Playwright · dedicated tenant-isolation and permission test suites · deterministic seed data with fixed test identities · Vercel (proposed initial hosting) · manual custom domains for the MVP · Stripe as a future billing integration.

No package versions are pinned yet. See [ADR-026](./docs/decisions-and-open-questions.md#adr-026--no-pinned-package-versions-yet).

## MVP modules

| Module | Summary |
| --- | --- |
| Core venue profile | Identity, address, hours, contact, branding, navigation, subdomain, custom domain, EN/TH content |
| Staff presence | Public staff profiles and an "in today" toggle, per venue, with consent |
| Feed | Text, image and video posts with draft, scheduled, approval, published and archived states |
| Events and calendar | Upcoming events in the venue timezone, with optional cross-venue promotion |
| Booking requests | Customer enquiries, manually accepted or declined, assigned and tracked |
| Atmosphere indicator | Quiet / getting busy / lively / packed, with a staleness expiry |
| Offers and promotions | Title, description, image, validity dates and terms, with basic redemption tracking |
| Social and contact links | Facebook, Instagram, X, TikTok, YouTube, LINE, WhatsApp, phone, website, share buttons |

Details in the [product brief](./docs/product-brief.md#6-mvp-modules).

## Roles

**Platform:** platform administrator, platform support.
**Business and venue:** business owner, venue manager, content editor, booking manager, staff.

Permissions are defined as explicit **actions**, not inferred from role names — **33 accepted actions**, matching the permissions matrix row for row. Platform access is entirely separate from venue-level roles, requires MFA before production launch, and reaching tenant data requires an audited, labelled support session that is read-only by default. The single exception is [`moderate_content`](./docs/roles-and-permissions.md#41-moderate_content-rules), which lets a platform administrator take prohibited public content **down** without a session — always with a reason, always audited, never able to author. See the [permissions matrix](./docs/roles-and-permissions.md#4-permissions-matrix) and the [support model](./docs/roles-and-permissions.md#7-platform-support-and-impersonation).

## Non-goals for the first release

Payroll · authoritative employee timekeeping · POS integration · stock management · real-time table inventory · booking deposits · full social-network publishing · advanced loyalty programmes · fully custom roles · dedicated content-moderator roles · arbitrary CSS · arbitrary JavaScript · separate deployments per venue · native mobile applications · microservices · public self-service signup · consolidated invoicing across a business's venues.

## Environments and test data

Local, staging and production are **completely separate**: their own Supabase projects, auth users, databases, storage buckets, secrets and external-service configuration. The environment identifier is explicit, destructive reset and seed commands refuse to run in production, and **production customer data is never copied into staging or local**. Realistic testing comes instead from a deterministic, fully fictional seed dataset with fixed test identities for every role. See [environments](./docs/architecture.md#17-environments-hosting-and-cicd) and [seed data](./docs/data-model.md#14-seed-data-for-local-and-staging).

## Unresolved matters

Legal, policy, pricing, retention and several feature-specific questions are **open and not decided** — but none of them blocks scaffolding. Data-retention durations in particular are deliberately unset: they remain configurable, no production deletion schedule is defined, and they must be confirmed as a policy and legal decision. Price points are likewise undecided and no figure is assumed anywhere.

Four questions are open with **recorded provisional boundaries** so the first build proceeds honestly without pre-empting them ([ADR-038](./docs/decisions-and-open-questions.md#adr-038--provisional-boundaries-for-the-four-non-blocking-feature-questions)): no production email integration in the initial scaffold, a system-font fallback until the approved font list exists, no database-changing preview deployments, and MFA represented architecturally with its enrolment and recovery flows still to be designed.

All of them are tracked in [docs/decisions-and-open-questions.md](./docs/decisions-and-open-questions.md), including the [resolved-question audit trail](./docs/decisions-and-open-questions.md#34-resolved-questions), the [decision history](./docs/decisions-and-open-questions.md#6-decision-history), the [launch blockers](./docs/decisions-and-open-questions.md#42-launch-blockers--required-before-production-not-before-code) and the [feature-specific decisions](./docs/decisions-and-open-questions.md#43-feature-specific-decisions--required-before-the-feature-not-before-the-scaffold).

## Next steps

1. **Scaffold the application**, choose and lock package versions, and write the first migrations, RLS policies, integrity constraints and seed data. No decision is outstanding for this.
2. While the schema is still cheap to change: **measure the RLS-sensitive query paths** against representative seed data ([OQ-30](./docs/decisions-and-open-questions.md#41-obligations-on-the-first-implementation)).
3. Before production launch: legal documentation, retention policy, a written moderation and takedown process, MFA enrolment and recovery, a live email provider, monitoring, a rehearsed backup restore, and a permanent staging environment.

## Repository layout (current)

```
README.md
docs/
  product-brief.md
  architecture.md
  roles-and-permissions.md
  data-model.md
  decisions-and-open-questions.md
```

## Licence and ownership

VenuBoard owns the platform software, generic themes, platform components and reusable platform improvements. Venues own the content they submit — posts, images, events, bookings and customer lists — and can export it. A licence has not yet been chosen for this repository. See [data ownership](./docs/product-brief.md#18-data-ownership).
