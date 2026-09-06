import type { ModuleAvailabilityState } from "@/core/ui/status";

export type BookingModuleAvailability = ModuleAvailabilityState | "paused";

export function mapBookingModuleAvailability(input: {
  entitled: boolean;
  enabled: boolean;
  accepting: boolean;
  entitlementSource: string | null;
  entitlementEnded: boolean;
  subscriptionState: string | null;
}): BookingModuleAvailability {
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

  if (!input.accepting) {
    return "paused";
  }

  if (input.entitlementSource === "trial") {
    return "trial";
  }

  return "enabled";
}

export function bookingIntakeIsOpen(
  availability: BookingModuleAvailability,
): boolean {
  return (
    availability === "enabled" ||
    availability === "trial" ||
    availability === "restricted"
  );
}
