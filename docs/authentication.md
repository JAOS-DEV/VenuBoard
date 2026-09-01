# Authentication, invitations and application authorisation

**Status:** Implemented on `feat/platform-venue-onboarding` · **Last updated:** 2026-09-01

This is the application foundation for identity, invitation acceptance, protected `/admin` and `/platform` routes, actor resolution and `can()`. Product modules are still absent. Unresolved questions (OQ-18, OQ-38, OQ-40) are preserved.

## Authentication flows

VenuBoard uses **Supabase Auth**. Both **email/password** and **email magic links** are offered on `/{locale}/sign-in`. The user chooses per visit ([ADR-013](./decisions-and-open-questions.md#adr-013--email-password-and-magic-link-authentication-with-mfa-support)).

| Route | Purpose |
| --- | --- |
| `/{locale}/sign-in` | Password and magic-link sign-in |
| `/{locale}/forgot-password` | Password reset request |
| `/{locale}/update-password` | Set a new password (authenticated recovery session) |
| `/{locale}/auth/callback` | PKCE `code` exchange; then a validated in-app redirect |
| `/{locale}/invite/{token}` | Inspect and accept an invitation |
| `/{locale}/unauthorized` | Authenticated caller without access |
| `/{locale}/admin` | Venue administration (membership required) |
| `/{locale}/platform` | Platform administration (platform role required) |
| `/{locale}/platform/onboard` | Platform-admin onboarding wizard (`manage_platform_tenants`) |
| `/{locale}/platform/venues/[venueId]` | Platform-admin venue overview after onboarding |

There is **no public self-service registration**. `signInWithOtp` on the sign-in page sets `shouldCreateUser: false`. An auth user is created only from a **pending invitation** (password on the invite page, or a magic link sent for that invitation email).

Sign-out is a server action that calls `supabase.auth.signOut()` and returns to the locale home.

The request proxy (`src/proxy.ts`) refreshes Auth cookies. It does **not** authorise. Protected layouts call `resolveRequestActor` and `canAccessVenueAdmin` / `canAccessPlatform`.

Generic errors are returned for failed sign-in and password reset. The UI never reports whether an email address has an account.

## Redirect policy

`parseSafeApplicationPath` is the only way a `next` query parameter becomes a redirect target.

Allowed: same-origin application paths such as `/admin`, `/en/admin`, `/invite/…`.

Rejected: absolute URLs, protocol-relative URLs, backslashes, `..`, encoded `/` `@` `\`, control characters, unknown two-letter locale prefixes, query/hash payloads.

The callback and sign-in forms never copy an unchecked parameter into `Location`.

## Invitation lifecycle

Tokens in the URL are hashed with SHA-256 before lookup (`app_private.invitation_token_hash`). `invitations.token_hash` never stores the raw token.

`inspect_invitation(p_token)` is `SECURITY DEFINER`, granted to `anon` and `authenticated`. It returns state for the token holder (`pending` / `invalid` / `expired` / `revoked` / `accepted`) plus the stored role and tenant names. A missing token is `invalid`. It does not disclose whether an arbitrary email has an account.

`accept_invitation(p_token)` is a single transaction:

1. Caller must be authenticated.
2. Invitation row is locked `FOR UPDATE`.
3. Normalised JWT/profile email must match the invitation email.
4. Account must not be `deactivated` or `suspended` (C15: `pending` may accept and becomes `active`).
5. Invitation must be pending, unexpired, unrevoked.
6. Role and `business_id` / `venue_id` come from the stored row, never the browser.
7. Platform roles cannot be created.
8. An existing **active** membership at a different role is a conflict (no escalation, C2).
9. Repeat submit by the same accepted member is **idempotent** (`ok: true`, `idempotent: true`) and does not duplicate the membership row.

Granted to `authenticated` only. `PUBLIC` and `anon` cannot execute it.

### Idempotent repeat

If the invitation is already `accepted` and the current user already holds the matching active membership, the function returns success without inserting another row. Concurrent retries are serialized on the invitation row lock.

### Email delivery (OQ-18)

No production provider is configured ([ADR-038](./decisions-and-open-questions.md#adr-038--provisional-boundaries-for-the-four-non-blocking-feature-questions)). `deliverInvitationLink` logs that **email was not sent**. Local/test logs a redacted recipient and the constructed URL. Magic links issued by local Supabase Auth still go through the local Inbucket/Mailpit catcher; that is Auth’s mailer, not VenuBoard invitation mail.

`buildInvitationUrl` is server-only. Do not log raw tokens.

Local seed invitation (not a login password): token `local-invite-atlas-editor-v1` for `new.editor@example.com` at Night Orchid as `content_editor`. Auth users in the seed still have **random unusable password hashes**.

## Actor and membership resolution

`resolveRequestActor` (server-only) builds an `Actor`:

- Anonymous visitor
- Authenticated user (profile from `public.users`, not JWT `user_metadata`)
- Platform role from `platform_roles` if present
- Own business/venue memberships when requested (`none` / `own` / `scoped` / `platform`)
- Active vs deactivated
- MFA representation (`users.mfa_enrolled_at` + session AAL when Supabase provides it)
- Current venue/business hint from an httpOnly `vb_admin_scope` cookie, re-checked against memberships

Deactivated users with a live Auth session do not pass `canAccessVenueAdmin` or `canAccessPlatform`.

A Playwright-only allowlisted cookie (`vb_test_identity`) exists so browser tests can render authenticated surfaces without committed passwords. It is honoured only when `VENUBOARD_ENV=test`, `NODE_ENV` is not `production`, and `VENUBOARD_ENABLE_TEST_IDENTITY` is `1` or `true`. Local, staging, preview and production ignore the cookie. Values are `authenticated-no-access`, `authenticated-deactivated`, `platform-admin` and `platform-support` only — not client-supplied roles. The cookie never creates a Supabase JWT; RPC success tests sign in through Auth after a runtime password is set in the Playwright Node process with `SUPABASE_SECRET_KEY`. Playwright starts its own server on port 3100 with those variables and does not reuse a local `next dev` process.

## `can()` versus RLS

```
can(actor, action, scope, context?) -> boolean
```

Implemented in `src/core/authz/can.ts`. The 33 action keys live in `src/core/authz/actions.ts` and match `permission_actions`. Grant rows are loaded from `role_action_grants` at runtime; the TypeScript layer does not ship a second full matrix.

- Unknown actions deny.
- Missing or incomplete scopes deny.
- Conditional cells default-deny except C2 (`venue_manager` / `assign_roles`) and C13 (`view_audit_log`), matching `app_private.conditional_tenant_grant_ok`.
- Platform support/admin tenant access requires a live support session; writes require confirmed write access (C19).
- `moderate_content` is `platform_admin` only and does not require a support session.

`can()` is fail-early UX. RLS, constraints and triggers remain the final boundary. `public.evaluate_permission` is the database counterpart used in SQL tests.

## Route protection

| Surface | Anonymous | Authenticated without access | Allowed |
| --- | --- | --- | --- |
| `/admin` | Redirect to sign-in with `next=/admin` | `/unauthorized` | Active business or venue membership |
| `/platform` | Redirect to sign-in with `next=/platform` | `/unauthorized` | Active `platform_admin` or `platform_support` |
| `/platform/onboard` | Redirect to sign-in with `next=/platform/onboard` | `/unauthorized` | Active `platform_admin` with `manage_platform_tenants` |
| Public `/v/[slug]` | Allowed | Allowed | No tenant session is used |

A valid venue slug in a URL never grants `/admin`. Platform administrators are not granted tenant `/admin` by role alone.

## MFA (OQ-40)

`MfaState` records `enrolledAt` and `authenticatorAssuranceLevel`. `requiredForPlatformRoles` is `true` in the type. `enforcement` is `represented-not-enforced`. `platformMfaBlocksAccess` currently returns false. There are no enrolment screens, recovery codes, or production enforcement dates.

## Local testing

```bash
npm run supabase:start    # Docker
npm run db:reset
npm run db:test           # includes supabase/tests/07_platform_onboarding.sql
npm run test:ci
npm run test:e2e
```

Interactive password sign-in against seed users is not possible: hashes are random. Create a user through a pending invitation, or use the Auth admin API locally. Magic links appear in the local mail catcher (see `npx supabase status`).

Playwright Chromium covers sign-in pages (en/th), the `/admin` anonymous redirect, the authenticated unauthorized cookie, invalid invitations, rejected external `next` values, and the platform onboarding wizard (admin access, support denial, EN/TH, validation, review, and an optional RPC success path when local Supabase keys are present). It is still not in CI (OQ-38).
