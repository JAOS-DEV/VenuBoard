import {
  isPermissionAction,
  isPlatformRecordAction,
  isTenantWriteAction,
  type PermissionAction,
} from "./actions";
import { effectiveGrant } from "./grants";
import {
  scopeIsComplete,
  staffOwnPresenceProvenConditions,
  type AuthzContext,
  type AuthzScope,
} from "./scope";
import {
  isActiveAuthenticatedActor,
  type Actor,
  type AuthenticatedActor,
  type SupportSessionView,
} from "@/core/actors/types";
import { platformMfaBlocksAccess } from "@/core/auth/mfa";

/**
 * Fail-early application authorisation. Row Level Security remains the final
 * boundary and this function must never be treated as a substitute for it.
 *
 * Unknown actions deny. Missing scopes deny. Conditional grants deny unless
 * the condition is already modelled (C2, C13) or proven in context.
 * C3 and C14 are proven via `ownConsentedStaffProfile` / provenConditions;
 * the database `may_set_staff_presence` helper remains the security boundary.
 * C6 is proven via `atmosphereFrontOfHouseProvenConditions` from the
 * venue setting; `may_write_atmosphere` remains the security boundary.
 */
export function can(
  actor: Actor,
  action: string,
  scope: AuthzScope | null | undefined,
  context: AuthzContext = {},
): boolean {
  if (!isPermissionAction(action)) {
    return false;
  }

  if (!scopeIsComplete(scope) || scope === null || scope === undefined) {
    return false;
  }

  if (!isActiveAuthenticatedActor(actor)) {
    return false;
  }

  if (platformMfaBlocksAccess(actor.mfa) && isPlatformRecordAction(action)) {
    return false;
  }

  if (tenantAllows(actor, action, scope, context)) {
    return true;
  }

  return platformAllows(actor, action, scope);
}

function tenantRoleAtScope(
  actor: AuthenticatedActor,
  scope: AuthzScope,
): string | null {
  if (scope.type === "venue") {
    const membership = actor.venueMemberships.find(
      (row) => row.venueId === scope.venueId,
    );
    if (membership !== undefined) {
      return membership.role;
    }

    const businessId =
      scope.businessId ??
      actor.currentBusinessId ??
      actor.venueMemberships.find((row) => row.venueId === scope.venueId)
        ?.businessId ??
      null;

    if (
      businessId !== null &&
      actor.businessMemberships.some(
        (row) => row.businessId === businessId && row.role === "business_owner",
      )
    ) {
      return "business_owner";
    }

    return null;
  }

  if (scope.type === "business") {
    const membership = actor.businessMemberships.find(
      (row) => row.businessId === scope.businessId,
    );
    return membership?.role ?? null;
  }

  if (scope.type === "self") {
    if (scope.venueId !== undefined) {
      return tenantRoleAtScope(actor, {
        type: "venue",
        venueId: scope.venueId,
      });
    }
    return null;
  }

  return null;
}

function tenantAllows(
  actor: AuthenticatedActor,
  action: PermissionAction,
  scope: AuthzScope,
  context: AuthzContext,
): boolean {
  if (scope.type === "platform") {
    return false;
  }

  const role = tenantRoleAtScope(actor, scope);
  if (role === null) {
    return false;
  }

  const proven = [...(context.provenConditions ?? [])];
  if (context.ownConsentedStaffProfile === true) {
    proven.push(...staffOwnPresenceProvenConditions(role, true));
  }

  if (!effectiveGrant(actor.grants, role, action, proven)) {
    return false;
  }

  if (
    action === "assign_roles" &&
    role === "venue_manager" &&
    context.targetUserId !== undefined &&
    context.targetUserId === actor.userId
  ) {
    return false;
  }

  if (
    action === "assign_roles" &&
    role === "venue_manager" &&
    context.requestedRole !== undefined &&
    (context.requestedRole === "business_owner" ||
      context.requestedRole === "platform_admin" ||
      context.requestedRole === "platform_support")
  ) {
    return false;
  }

  if (scope.type === "self" && scope.userId !== undefined) {
    return scope.userId === actor.userId;
  }

  return true;
}

function sessionCovers(
  sessions: readonly SupportSessionView[],
  scope: AuthzScope,
): SupportSessionView | undefined {
  return sessions.find((session) => {
    if (scope.type === "venue") {
      if (session.targetVenueId === scope.venueId) {
        return true;
      }
      if (
        scope.businessId !== undefined &&
        session.targetBusinessId === scope.businessId
      ) {
        return true;
      }
    }
    if (scope.type === "business") {
      return session.targetBusinessId === scope.businessId;
    }
    return false;
  });
}

function platformAllows(
  actor: AuthenticatedActor,
  action: PermissionAction,
  scope: AuthzScope,
): boolean {
  if (actor.platformRole === null) {
    return false;
  }

  const grant = actor.grants.find(
    (row) => row.roleKey === actor.platformRole && row.actionKey === action,
  );

  if (grant === undefined || grant.grantKind === "deny") {
    return false;
  }

  if (action === "moderate_content") {
    return (
      actor.platformRole === "platform_admin" && grant.grantKind === "allow"
    );
  }

  if (isPlatformRecordAction(action)) {
    return grant.grantKind === "allow" && scope.type === "platform";
  }

  if (scope.type === "platform") {
    return grant.grantKind === "allow";
  }

  if (scope.type !== "business" && scope.type !== "venue") {
    return false;
  }

  const session = sessionCovers(actor.supportSessions, scope);
  if (session === undefined) {
    return false;
  }

  if (isTenantWriteAction(action)) {
    return session.writeActive;
  }

  return true;
}

export function canAccessVenueAdmin(actor: Actor): boolean {
  if (!isActiveAuthenticatedActor(actor)) {
    return false;
  }

  return (
    actor.businessMemberships.length > 0 || actor.venueMemberships.length > 0
  );
}

export function canAccessPlatform(actor: Actor): boolean {
  if (!isActiveAuthenticatedActor(actor)) {
    return false;
  }

  if (actor.platformRole === null) {
    return false;
  }

  return !platformMfaBlocksAccess(actor.mfa);
}

export function canOnboardTenants(actor: Actor): boolean {
  return can(actor, "manage_platform_tenants", { type: "platform" });
}
