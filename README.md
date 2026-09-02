# VenuBoard

**A modular, multi-tenant, white-label website and management platform for venues.**

> **Repository status: application scaffold plus foundation schema, authentication, invitations, platform-led onboarding and the staff presence module.** The Next.js App Router shell, locale routing, environment validation, local Supabase, PostgreSQL migrations (tenants, memberships, permissions, entitlements, RLS, staff presence), invitation acceptance, actor resolution, `can()`, the platform onboarding wizard/RPC, venue-admin staff management, the public staff carousel, and pgTAP tests exist. **Remaining product modules are not implemented** — no feed, events, bookings, offers, atmosphere, analytics UI, notifications, media uploads or support-session UI.
>
> **Decision status (2026-08-30):** all scaffolding ADRs are accepted. Remaining work is split into [launch blockers](./docs/decisions-and-open-questions.md#42-launch-blockers--required-before-production-not-before-code) and [feature-specific decisions](./docs/decisions-and-open-questions.md#43-feature-specific-decisions--required-before-the-feature-not-before-the-scaffold). The first-schema obligations are in [section 4.1](./docs/decisions-and-open-questions.md#41-obligations-on-the-first-implementation).

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

| Document                                                                       | What it covers                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [docs/staff-presence.md](./docs/staff-presence.md)                             | Staff directory and live presence: public vs private, consent, expiry, authorisation                                                                                                                               |
| [docs/architecture.md](./docs/architecture.md)                                 | Technical architecture, system context diagram, stack, module structure, routing, tenant isolation, internationalisation, testing, environments and hosting                                                        |
| [docs/authentication.md](./docs/authentication.md)                             | Sign-in, magic links, invitation acceptance, actor resolution, `can()` versus RLS, route protection, MFA representation, local testing                                                                             |
| [docs/roles-and-permissions.md](./docs/roles-and-permissions.md)               | Role catalogue, the 33 actions, the permissions matrix, support and impersonation model, content moderation rules, public/private data access                                                                      |
| [docs/data-model.md](./docs/data-model.md)                                     | Tenant hierarchy, entity relationships, module tables, translation tables, tenant-key integrity constraints, controlled vocabularies, Row Level Security patterns, moderation and quarantine, seed data, retention |
| [docs/decisions-and-open-questions.md](./docs/decisions-and-open-questions.md) | Architecture decision records, the dated decision history, and every unresolved legal, policy, pricing, retention and technical question                                                                           |

**Start here:** [product brief](./docs/product-brief.md) → [architecture](./docs/architecture.md) → [decisions and open questions](./docs/decisions-and-open-questions.md).

## Prerequisites

- **Node.js 24** (see `.nvmrc`). Node 20.9 or later is the declared engine minimum; local development uses 24 so TypeScript scripts run without a separate loader.
- **npm** (ships with Node). This is the current package manager for the scaffold; it is not a locked architectural decision and can be revisited.
- **Git**
- **Docker Desktop** — only if you start the local Supabase stack. The placeholder application renders without it.

## Installation

```bash
git clone https://github.com/JAOS-DEV/VenuBoard.git
cd VenuBoard
npm install
copy .env.example .env.local   # Windows: Copy-Item .env.example .env.local
```

`.env.local` is git-ignored. Leave the Supabase values empty for the placeholder shell. Set `VENUBOARD_ENV=local`.

## Local development

```bash
npm run local:start
```

Then open http://localhost:3000/en/dev.

That local-only developer hub lists:

| Service                | URL                                   |
| ---------------------- | ------------------------------------- |
| Application            | http://localhost:3000                 |
| Developer hub          | http://localhost:3000/en/dev          |
| English / Thai sign-in | `/en/sign-in` and `/th/sign-in`       |
| Supabase Studio        | http://127.0.0.1:54323                |
| Local email inbox      | http://127.0.0.1:54324                |
| Auth health            | http://127.0.0.1:54321/auth/v1/health |

Seeded personas are fictional `example.com` identities. There are **no committed passwords**. Request a magic link from the normal sign-in page, then open the local inbox. The hub can prefill an allowlisted persona email; it does not sign anyone in.

```bash
npm run local:status    # URLs and commands only — no keys
npm run local:reset     # local Docker database only; same guards as db:reset
npm run supabase:stop
```

The developer hub is a real 404 outside ordinary local development (`VENUBOARD_ENV=local` and `NODE_ENV` is not `production`). The Playwright `vb_test_identity` cookie remains test-only. `.env.local` stays git-ignored.

`/admin` and `/platform` still require a signed-in identity. See [docs/authentication.md](./docs/authentication.md) for invitation-based local sign-in and the test identity cookie.

## Environment files

| File           | Role                                                                  |
| -------------- | --------------------------------------------------------------------- |
| `.env.example` | Committed template. Names and comments only — never real credentials  |
| `.env.local`   | Your machine. Ignored. Copy of the example with `VENUBOARD_ENV=local` |

`VENUBOARD_ENV` is required and has no default. Valid values: `local`, `staging`, `production`, `test`. A misspelled or missing value fails validation at boot. Production cannot point at localhost and cannot use placeholder values.

`SUPABASE_SECRET_KEY` is server-only and is not used on tenant request paths. Do not prefix it with `NEXT_PUBLIC_`. `NEXT_PUBLIC_APP_ORIGIN` is optional in local and test; it is the public origin for Auth callbacks and invitation links.

## Local Supabase

The repository has a local Supabase project configuration (`supabase/config.toml`, `project_id = "venuboard"`). **No hosted Supabase project is created or linked.**

```bash
npm run local:start       # local Supabase, then Next.js; no database reset
npm run supabase:start    # requires Docker; also used by local:start
npm run supabase:status
npm run local:reset       # same guarded local reset-and-seed as db:reset
npm run db:reset          # refused when VENUBOARD_ENV=production; local Docker only
npm run db:test           # pgTAP against the local database
npm run db:types          # regenerate src/core/db/types.ts from the local schema
npm run db:types:check    # generate, format, fail if types.ts would change
npm run db:seed           # same production guard; does not re-apply seed files
npm run db:perf:seed      # large local-only fixture; not part of reset or CI
npm run db:perf           # EXPLAIN (ANALYZE, BUFFERS) baseline; not production
npm run supabase:stop
```

`db:reset` runs the production guard, refuses a linked hosted project, drops the **local** database, replays `supabase/migrations/`, then loads `supabase/seed/01_foundation.sql`. That erases local data only. Staging reset is not implemented — there is no staging environment yet. The performance fixture is not loaded.

`db:seed` does not run the SQL a second time (the UUIDs would collide). Use `db:reset` to reseed.

SQL tests impersonate seed users via JWT `sub` claims. They do not sign in and do not use committed passwords (auth hashes are random and unusable).

New migrations are timestamp-prefixed SQL under `supabase/migrations/`. Apply them with `db:reset` locally. Do not edit a hosted dashboard. After `npm run db:types`, run `npm run format` so the generated file matches Prettier.

`db:reset`, `db:seed`, `db:perf:seed` and `db:types:check` are `.mts` wrappers so Node treats them as ES modules without setting `"type": "module"` on the Next.js package. Node may still print `MODULE_TYPELESS_PACKAGE_JSON` for imported `src/core/env/*.ts` files. That warning is documented rather than suppressed; adding `"type": "module"` is not done because it would change how Next.js and the rest of the repo resolve modules.

Reproduce the RLS performance baseline with `npm run db:perf:seed` then `npm run db:perf` after an ordinary reset. Plans are recorded in [docs/performance/foundation-rls-baseline.md](./docs/performance/foundation-rls-baseline.md). CI does not load the large fixture.

## Available scripts

| Script                            | What it does                                                                                                            |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                     | Next.js development server                                                                                              |
| `npm run build`                   | Production build                                                                                                        |
| `npm run start`                   | Serve the production build                                                                                              |
| `npm run lint`                    | ESLint                                                                                                                  |
| `npm run typecheck`               | Strict TypeScript check                                                                                                 |
| `npm run format` / `format:check` | Prettier write / check (see Formatting)                                                                                 |
| `npm test` / `test:ci`            | Vitest watch / single run                                                                                               |
| `npm run test:e2e`                | Playwright Chromium smoke tests                                                                                         |
| `npm run test:e2e:install`        | Install Chromium only (not every browser)                                                                               |
| `npm run verify`                  | Format, lint, typecheck, unit tests, production build                                                                   |
| `npm run local:start`             | Start local Supabase, then Next.js. No database reset, no hosted link                                                   |
| `npm run local:reset`             | Guarded local Docker reset-and-seed (same as `db:reset`)                                                                |
| `npm run local:status`            | Print local URLs and commands. No keys or passwords                                                                     |
| `npm run supabase:*` / `db:*`     | Local Supabase: start/stop/status, guarded reset, seed notice, typegen, `db:test`, `db:types:check`, local perf fixture |

## Testing

- **Unit:** Vitest + React Testing Library. Environment validation, the production destructive-operation guard, the application shell, and a check that generated database types are not the scaffold placeholder.
- **SQL (local Docker and GitHub Actions):** `npm run db:test`. pgTAP: structural integrity, composite tenant keys, RLS denied behaviour, permission catalogue, C1–C19 foundation enforcement. `.github/workflows/database.yml` starts repository-local Supabase, resets, tests, and checks generated types. No hosted project. The large performance fixture is not part of CI.
- **End-to-end:** Playwright, Chromium only. Smoke-tests the public placeholder. Not in CI until the preview and test-database strategy is accepted (OQ-38).
- **Isolation and permissions (application):** still to be written in `tests/isolation` and `tests/permissions` once `can()` and auth exist. Those checks fail early; they do not replace `supabase/tests/`.

```bash
npm run test:ci
npm run test:e2e          # after `npm run test:e2e:install` if Chromium is missing
```

## Formatting

Prettier formats source, configuration, tests, scripts and this README. Product and architecture Markdown under `docs/` is excluded (`docs/**/*.md` in `.prettierignore`) so accepted wording and heading anchors are not rewritten. Do not add a Markdown formatter to “fix” that.

## Project structure

```
src/app/[locale]/          locale-aware routes: /, /admin, /platform, /dev, /v/[venueSlug]
src/components/            shared shell, environment badge, shadcn/ui (Button, Card, Badge)
src/core/dev/              local-only developer hub guard and fictional persona catalogue
src/core/env/              environment identifier, Zod validation, production guard
src/core/db/               browser and server clients; generated Database types
src/core/i18n/             next-intl routing (en, th)
src/proxy.ts               locale negotiation only (Next.js 16 proxy)
messages/                  interface strings (en.json, th.json)
supabase/migrations        foundation schema, RLS, security hardening
supabase/seed              deterministic fictional dataset (small)
supabase/perf              optional local RLS volume fixture (not in reset or CI)
supabase/tests             pgTAP structural, isolation, permission and C1–C19 tests
scripts/                   guarded local start/status, db:reset, db:seed, db:perf and types-check wrappers
tests/unit  tests/e2e      scaffold tests plus generated-types check
tests/isolation            TODO — application-level suite once can() exists
tests/permissions          TODO — application-level suite once can() exists
docs/                      product and architecture documentation (not auto-formatted)
docs/security              conditional-permission enforcement map (C1–C19)
docs/performance           local RLS EXPLAIN baseline (OQ-30)
```

## What is not implemented yet

Remaining product work includes feed posts, events, bookings, offers, atmosphere, analytics dashboards, notifications, media uploads, support-session UI, custom-domain tenant resolution, and production integrations. Authentication, invitations, `can()`, platform onboarding and staff presence are implemented.

The database **does** implement the foundation: users, platform roles, businesses, venues, memberships, invitations, the 33-action catalogue, modules/plans/entitlements, venue translations, audit, moderation, RLS and staff presence. See `supabase/migrations/`.

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

**npm** (current installer; not locked) · Next.js (App Router) · TypeScript (strict) · React · Tailwind CSS · shadcn/ui · PostgreSQL with no enum types (text + `CHECK` constraints and reference tables) · Supabase (managed PostgreSQL, auth, storage, realtime, Row Level Security) in `ap-southeast-1` · SQL migrations in-repository · email auth with **both password and magic link**, plus MFA support · invitation-based, operator-led onboarding · `next-intl` for interface strings with **normalised translation tables** for venue content (English + Thai) · Zod · React Hook Form · Vitest · Playwright · dedicated tenant-isolation and permission test suites · deterministic seed data with fixed test identities · Vercel (proposed initial hosting) · manual custom domains for the MVP · Stripe as a future billing integration.

Generated package versions live in `package.json`. [ADR-026](./docs/decisions-and-open-questions.md#adr-026--no-pinned-package-versions-yet) remains proposed: recording what the scaffold installed is not the same as locking those versions as policy.

## MVP modules

| Module                   | Summary                                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------ |
| Core venue profile       | Identity, address, hours, contact, branding, navigation, subdomain, custom domain, EN/TH content |
| Staff presence           | Public staff profiles and an "in today" toggle, per venue, with consent                          |
| Feed                     | Text, image and video posts with draft, scheduled, approval, published and archived states       |
| Events and calendar      | Upcoming events in the venue timezone, with optional cross-venue promotion                       |
| Booking requests         | Customer enquiries, manually accepted or declined, assigned and tracked                          |
| Atmosphere indicator     | Quiet / getting busy / lively / packed, with a staleness expiry                                  |
| Offers and promotions    | Title, description, image, validity dates and terms, with basic redemption tracking              |
| Social and contact links | Facebook, Instagram, X, TikTok, YouTube, LINE, WhatsApp, phone, website, share buttons           |

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

1. Keep measuring the RLS-sensitive query paths as tables grow ([docs/performance/foundation-rls-baseline.md](./docs/performance/foundation-rls-baseline.md), OQ-30).
2. Implement authentication and `can(actor, action, scope)` against this schema, then the first product module.
3. Before production launch: legal documentation, retention policy, a written moderation and takedown process, MFA enrolment and recovery, a live email provider, monitoring, a rehearsed backup restore, and a permanent staging environment.

## Licence and ownership

VenuBoard owns the platform software, generic themes, platform components and reusable platform improvements. Venues own the content they submit — posts, images, events, bookings and customer lists — and can export it. A licence has not yet been chosen for this repository. See [data ownership](./docs/product-brief.md#18-data-ownership).
