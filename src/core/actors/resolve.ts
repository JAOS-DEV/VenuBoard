import "server-only";

import { cookies } from "next/headers";

import {
  ANONYMOUS_ACTOR,
  inactiveMfa,
  type AccountStatus,
  type Actor,
  type AuthenticatedActor,
  type BusinessMembership,
  type PlatformRole,
  type SupportSessionView,
  type VenueMembership,
} from "@/core/actors/types";
import {
  createMfaState,
  type AuthenticatorAssuranceLevel,
} from "@/core/auth/mfa";
import { parseAdminScopeCookie } from "@/core/auth/scope-cookie";
import {
  isTestIdentityEnabled,
  isTestIdentityFlagEnabled,
  isTestIdentityToken,
  TEST_IDENTITY_COOKIE,
  type TestIdentityToken,
} from "@/core/auth/test-identity";
import type { RoleActionGrant } from "@/core/authz/grants";
import { getSupabaseConnection } from "@/core/db/connection";
import { createSupabaseServerClient } from "@/core/db/server-client";
import { serverEnv } from "@/core/env/server";

export type MembershipLoadMode = "none" | "own" | "scoped" | "platform";

export interface ResolveActorOptions {
  memberships?: MembershipLoadMode;
  venueId?: string;
  businessId?: string;
}

const ACCOUNT_STATUSES = new Set<AccountStatus>([
  "pending",
  "active",
  "suspended",
  "deactivated",
]);

function asAccountStatus(value: string): AccountStatus {
  return ACCOUNT_STATUSES.has(value as AccountStatus)
    ? (value as AccountStatus)
    : "pending";
}

function asPlatformRole(value: string | null): PlatformRole | null {
  return value === "platform_admin" || value === "platform_support"
    ? value
    : null;
}

function asAal(value: string | undefined): AuthenticatorAssuranceLevel {
  return value === "aal2" ? "aal2" : "aal1";
}

function sessionAssuranceLevel(
  session: { aal?: string } | null,
): string | undefined {
  if (session === null) {
    return undefined;
  }
  if ("aal" in session && typeof session.aal === "string") {
    return session.aal;
  }
  return undefined;
}

function testActor(token: TestIdentityToken): AuthenticatedActor {
  if (token === "authenticated-deactivated") {
    return {
      kind: "authenticated",
      userId: "00000000-0000-4000-8000-000000000026",
      email: "deactivated.user@example.com",
      displayName: "Deactivated User",
      accountStatus: "deactivated",
      deactivatedAt: "2026-08-01T00:00:00.000Z",
      platformRole: null,
      businessMemberships: [],
      venueMemberships: [],
      currentBusinessId: null,
      currentVenueId: null,
      mfa: inactiveMfa(),
      supportSessions: [],
      grants: [],
    };
  }

  if (token === "platform-admin") {
    return {
      kind: "authenticated",
      userId: "00000000-0000-4000-8000-000000000001",
      email: "platform.admin@example.com",
      displayName: "Platform Admin",
      accountStatus: "active",
      deactivatedAt: null,
      platformRole: "platform_admin",
      businessMemberships: [],
      venueMemberships: [],
      currentBusinessId: null,
      currentVenueId: null,
      mfa: inactiveMfa(),
      supportSessions: [],
      grants: [
        {
          roleKey: "platform_admin",
          actionKey: "manage_platform_tenants",
          grantKind: "allow",
        },
        {
          roleKey: "platform_admin",
          actionKey: "view_audit_log",
          grantKind: "allow",
        },
      ],
    };
  }

  if (token === "platform-support") {
    return {
      kind: "authenticated",
      userId: "00000000-0000-4000-8000-000000000002",
      email: "platform.support@example.com",
      displayName: "Platform Support",
      accountStatus: "active",
      deactivatedAt: null,
      platformRole: "platform_support",
      businessMemberships: [],
      venueMemberships: [],
      currentBusinessId: null,
      currentVenueId: null,
      mfa: inactiveMfa(),
      supportSessions: [],
      grants: [
        {
          roleKey: "platform_support",
          actionKey: "view_audit_log",
          grantKind: "allow",
        },
      ],
    };
  }

  return {
    kind: "authenticated",
    userId: "00000000-0000-4000-8000-00000000ffff",
    email: "no.access@example.com",
    displayName: "No Access",
    accountStatus: "active",
    deactivatedAt: null,
    platformRole: null,
    businessMemberships: [],
    venueMemberships: [],
    currentBusinessId: null,
    currentVenueId: null,
    mfa: inactiveMfa(),
    supportSessions: [],
    grants: [],
  };
}

async function maybeTestActor(): Promise<Actor | null> {
  if (
    !isTestIdentityEnabled(
      serverEnv.VENUBOARD_ENV,
      process.env.NODE_ENV,
      isTestIdentityFlagEnabled(serverEnv.VENUBOARD_ENABLE_TEST_IDENTITY),
    )
  ) {
    return null;
  }

  const cookieStore = await cookies();
  const raw = cookieStore.get(TEST_IDENTITY_COOKIE)?.value;
  if (!isTestIdentityToken(raw)) {
    return null;
  }

  return testActor(raw);
}

export async function resolveRequestActor(
  options: ResolveActorOptions = {},
): Promise<Actor> {
  const memberships = options.memberships ?? "none";

  if (getSupabaseConnection() === null) {
    const test = await maybeTestActor();
    return test ?? ANONYMOUS_ACTOR;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (user === null) {
    const test = await maybeTestActor();
    return test ?? ANONYMOUS_ACTOR;
  }

  const { data: profile } = await supabase
    .from("users")
    .select(
      "id, email, display_name, account_status, deactivated_at, mfa_enrolled_at",
    )
    .eq("id", user.id)
    .maybeSingle();

  if (profile === null) {
    return ANONYMOUS_ACTOR;
  }

  const { data: platformRow } = await supabase
    .from("platform_roles")
    .select("role")
    .eq("user_id", user.id)
    .is("revoked_at", null)
    .maybeSingle();

  let businessMemberships: BusinessMembership[] = [];
  let venueMemberships: VenueMembership[] = [];
  let supportSessions: SupportSessionView[] = [];
  let grants: RoleActionGrant[] = [];

  if (memberships !== "none") {
    const { data: grantRows } = await supabase
      .from("role_action_grants")
      .select("role_key, action_key, grant_kind");

    grants = (grantRows ?? []).map((row) => ({
      roleKey: row.role_key,
      actionKey: row.action_key,
      grantKind: row.grant_kind as RoleActionGrant["grantKind"],
    }));
  }

  if (memberships === "own" || memberships === "scoped") {
    let businessQuery = supabase
      .from("business_memberships")
      .select("business_id, role, status")
      .eq("user_id", user.id)
      .eq("status", "active")
      .is("deactivated_at", null);

    if (memberships === "scoped" && options.businessId !== undefined) {
      businessQuery = businessQuery.eq("business_id", options.businessId);
    }

    const { data: businessRows } = await businessQuery;
    businessMemberships = (businessRows ?? [])
      .filter((row) => row.role === "business_owner")
      .map((row) => ({
        businessId: row.business_id,
        role: "business_owner" as const,
        status: "active" as const,
      }));

    let venueQuery = supabase
      .from("venue_memberships")
      .select("venue_id, role, status")
      .eq("user_id", user.id)
      .eq("status", "active")
      .is("deactivated_at", null);

    if (memberships === "scoped" && options.venueId !== undefined) {
      venueQuery = venueQuery.eq("venue_id", options.venueId);
    }

    const { data: venueRows } = await venueQuery;
    venueMemberships = (venueRows ?? [])
      .filter(
        (row) =>
          row.role === "venue_manager" ||
          row.role === "content_editor" ||
          row.role === "booking_manager" ||
          row.role === "staff",
      )
      .map((row) => ({
        venueId: row.venue_id,
        businessId: options.businessId ?? null,
        role: row.role as VenueMembership["role"],
        status: "active" as const,
      }));
  }

  if (
    (memberships === "platform" || memberships === "own") &&
    platformRow !== null
  ) {
    const { data: sessionRows } = await supabase
      .from("support_sessions")
      .select(
        "id, target_business_id, target_venue_id, mode, write_granted_at, write_expires_at, ended_at, expires_at",
      )
      .eq("operator_user_id", user.id)
      .is("ended_at", null);

    const now = Date.now();
    supportSessions = (sessionRows ?? [])
      .filter((row) => Date.parse(row.expires_at) > now)
      .map((row) => ({
        id: row.id,
        targetBusinessId: row.target_business_id,
        targetVenueId: row.target_venue_id,
        mode: row.mode === "write" ? "write" : "read_only",
        writeActive:
          row.mode === "write" &&
          row.write_granted_at !== null &&
          row.write_expires_at !== null &&
          Date.parse(row.write_expires_at) > now,
      }));
  }

  const cookieStore = await cookies();
  const hinted = parseAdminScopeCookie(
    cookieStore.get("vb_admin_scope")?.value,
  );

  const currentVenueId =
    options.venueId ??
    (hinted !== null &&
    venueMemberships.some((row) => row.venueId === hinted.venueId)
      ? hinted.venueId
      : (venueMemberships[0]?.venueId ?? null));

  const currentBusinessId =
    options.businessId ??
    (hinted !== null &&
    businessMemberships.some((row) => row.businessId === hinted.businessId)
      ? hinted.businessId
      : (businessMemberships[0]?.businessId ??
        venueMemberships[0]?.businessId ??
        null));

  return {
    kind: "authenticated",
    userId: profile.id,
    email: profile.email,
    displayName: profile.display_name,
    accountStatus: asAccountStatus(profile.account_status),
    deactivatedAt: profile.deactivated_at,
    platformRole: asPlatformRole(platformRow?.role ?? null),
    businessMemberships,
    venueMemberships,
    currentBusinessId,
    currentVenueId,
    mfa: createMfaState({
      enrolledAt: profile.mfa_enrolled_at,
      authenticatorAssuranceLevel: asAal(
        sessionAssuranceLevel(session as { aal?: string } | null),
      ),
    }),
    supportSessions,
    grants,
  };
}

export function headerIdentity(actor: Actor): {
  signedIn: boolean;
  displayName: string | null;
} {
  if (actor.kind !== "authenticated") {
    return { signedIn: false, displayName: null };
  }
  return { signedIn: true, displayName: actor.displayName };
}
