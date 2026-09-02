import type { StaffConsentState, StaffMemberStatus } from "./constants";

export type StaffModuleAvailability =
  | "not_entitled"
  | "entitled_disabled"
  | "enabled"
  | "trial"
  | "expired"
  | "restricted"
  | "suspended";

export function mapStaffModuleAvailability(input: {
  entitled: boolean;
  enabled: boolean;
  entitlementSource: string | null;
  entitlementEnded: boolean;
  subscriptionState: string | null;
}): StaffModuleAvailability {
  if (
    input.subscriptionState === "suspended" ||
    input.subscriptionState === "cancelled" ||
    input.subscriptionState === "scheduled_for_deletion" ||
    input.subscriptionState === "deleted"
  ) {
    return "suspended";
  }

  if (input.subscriptionState === "restricted") {
    return "restricted";
  }

  if (input.entitlementEnded || !input.entitled) {
    return input.entitlementEnded ? "expired" : "not_entitled";
  }

  if (!input.enabled) {
    return "entitled_disabled";
  }

  if (input.entitlementSource === "trial") {
    return "trial";
  }

  return "enabled";
}

export function restoredStaffSafeState(): {
  status: StaffMemberStatus;
  publicationState: "draft";
  consentState: Extract<StaffConsentState, "pending">;
  presenceState: "not_present";
} {
  return {
    status: "active",
    publicationState: "draft",
    consentState: "pending",
    presenceState: "not_present",
  };
}

export function deactivationResetsPresence(): "not_present" {
  return "not_present";
}
