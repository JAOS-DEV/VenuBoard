export type FeedModuleAvailability =
  | "not_entitled"
  | "entitled_disabled"
  | "enabled"
  | "trial"
  | "expired"
  | "restricted"
  | "suspended";

export function mapFeedModuleAvailability(input: {
  entitled: boolean;
  enabled: boolean;
  entitlementSource: string | null;
  entitlementEnded: boolean;
  subscriptionState: string | null;
}): FeedModuleAvailability {
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
