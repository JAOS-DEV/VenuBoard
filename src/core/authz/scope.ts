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
