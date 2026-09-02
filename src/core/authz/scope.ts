export type AuthzScopeType = "platform" | "business" | "venue" | "self";

export type AuthzScope =
  | { type: "platform" }
  | { type: "business"; businessId: string }
  | { type: "venue"; venueId: string; businessId?: string }
  | { type: "self"; userId?: string; venueId?: string };

export interface AuthzContext {
  targetUserId?: string;
  requestedRole?: string;
  provenConditions?: readonly string[];
  ownConsentedStaffProfile?: boolean;
}

export function staffOwnPresenceProvenConditions(
  roleKey: string | null,
  ownConsentedStaffProfile: boolean,
): string[] {
  if (!ownConsentedStaffProfile || roleKey === null) {
    return [];
  }
  if (roleKey === "staff") {
    return ["staff:toggle_staff_presence"];
  }
  return [`${roleKey}:toggle_own_presence`];
}

export function scopeIsComplete(scope: AuthzScope | null | undefined): boolean {
  if (scope === null || scope === undefined) {
    return false;
  }

  switch (scope.type) {
    case "platform":
      return true;
    case "business":
      return scope.businessId.length > 0;
    case "venue":
      return scope.venueId.length > 0;
    case "self":
      return true;
    default:
      return false;
  }
}
