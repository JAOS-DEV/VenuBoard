import { can } from "@/core/authz/can";
import {
  isActiveAuthenticatedActor,
  type Actor,
  type AuthenticatedActor,
} from "@/core/actors/types";
import type { AuthzScope } from "@/core/authz/scope";

const STAFF_VENUE_ACTIONS = [
  "manage_public_staff_profiles",
  "toggle_staff_presence",
  "view_private_staff_data",
] as const;

const STAFF_SELF_ACTIONS = [
  "manage_own_public_profile",
  "manage_own_consent",
  "toggle_own_presence",
] as const;

const EVENT_ACTIONS = [
  "create_content",
  "submit_content_for_approval",
  "approve_content",
  "publish_content",
  "manage_events",
] as const;

function venueScopes(actor: AuthenticatedActor): AuthzScope[] {
  const scopes: AuthzScope[] = actor.venueMemberships.map((membership) => ({
    type: "venue",
    venueId: membership.venueId,
    businessId: membership.businessId ?? undefined,
  }));

  if (
    actor.currentVenueId !== null &&
    !scopes.some(
      (scope) =>
        scope.type === "venue" && scope.venueId === actor.currentVenueId,
    )
  ) {
    scopes.push({
      type: "venue",
      venueId: actor.currentVenueId,
      businessId: actor.currentBusinessId ?? undefined,
    });
  }

  return scopes;
}

function hasStaffAccess(actor: AuthenticatedActor): boolean {
  const scopes = venueScopes(actor);
  for (const scope of scopes) {
    if (scope.type !== "venue") {
      continue;
    }
    if (STAFF_VENUE_ACTIONS.some((action) => can(actor, action, scope))) {
      return true;
    }
    if (
      STAFF_SELF_ACTIONS.some((action) =>
        can(actor, action, {
          type: "self",
          venueId: scope.venueId,
          userId: actor.userId,
        }),
      )
    ) {
      return true;
    }
  }
  return actor.businessMemberships.length > 0;
}

function hasEventsAccess(actor: AuthenticatedActor): boolean {
  const scopes = venueScopes(actor);
  for (const scope of scopes) {
    if (EVENT_ACTIONS.some((action) => can(actor, action, scope))) {
      return true;
    }
  }
  return actor.businessMemberships.length > 0;
}

/**
 * UX-only navigation flags. Pages still enforce `can()` and the database
 * remains the security boundary.
 */
export function venueAdminNavAccess(actor: Actor): {
  home: boolean;
  staff: boolean;
  events: boolean;
} {
  if (!isActiveAuthenticatedActor(actor)) {
    return { home: false, staff: false, events: false };
  }

  return {
    home: true,
    staff: hasStaffAccess(actor),
    events: hasEventsAccess(actor),
  };
}
