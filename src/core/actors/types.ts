import { createMfaState, type MfaState } from "@/core/auth/mfa";
import type { RoleActionGrant } from "@/core/authz/grants";

export type AccountStatus = "pending" | "active" | "suspended" | "deactivated";

export type PlatformRole = "platform_admin" | "platform_support";

export type TenantRole =
  | "business_owner"
  | "venue_manager"
  | "content_editor"
  | "booking_manager"
  | "staff";

export interface BusinessMembership {
  businessId: string;
  role: "business_owner";
  status: "active";
}

export interface VenueMembership {
  venueId: string;
  businessId: string | null;
  role: Exclude<TenantRole, "business_owner">;
  status: "active";
}

export interface SupportSessionView {
  id: string;
  targetBusinessId: string | null;
  targetVenueId: string | null;
  mode: "read_only" | "write";
  writeActive: boolean;
}

export interface AnonymousActor {
  kind: "anonymous";
}

export interface AuthenticatedActor {
  kind: "authenticated";
  userId: string;
  email: string;
  displayName: string;
  accountStatus: AccountStatus;
  deactivatedAt: string | null;
  platformRole: PlatformRole | null;
  businessMemberships: readonly BusinessMembership[];
  venueMemberships: readonly VenueMembership[];
  currentBusinessId: string | null;
  currentVenueId: string | null;
  mfa: MfaState;
  supportSessions: readonly SupportSessionView[];
  grants: readonly RoleActionGrant[];
}

export type Actor = AnonymousActor | AuthenticatedActor;

export const ANONYMOUS_ACTOR: AnonymousActor = { kind: "anonymous" };

export function isAuthenticatedActor(
  actor: Actor,
): actor is AuthenticatedActor {
  return actor.kind === "authenticated";
}

export function isActiveAuthenticatedActor(
  actor: Actor,
): actor is AuthenticatedActor {
  return (
    actor.kind === "authenticated" &&
    actor.accountStatus === "active" &&
    actor.deactivatedAt === null
  );
}

export function inactiveMfa(): MfaState {
  return createMfaState({
    enrolledAt: null,
    authenticatorAssuranceLevel: "aal1",
  });
}
