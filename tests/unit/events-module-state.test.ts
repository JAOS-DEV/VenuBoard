import { describe, expect, it } from "vitest";

import { mapEventsModuleAvailability } from "@/core/events/module-state";

describe("mapEventsModuleAvailability", () => {
  it("returns 'suspended' when subscriptionState is suspended", () => {
    expect(
      mapEventsModuleAvailability({
        entitled: true,
        enabled: true,
        entitlementSource: "plan",
        entitlementEnded: false,
        subscriptionState: "suspended",
      }),
    ).toBe("suspended");
  });

  it("returns 'suspended' for cancelled subscription", () => {
    expect(
      mapEventsModuleAvailability({
        entitled: true,
        enabled: true,
        entitlementSource: "plan",
        entitlementEnded: false,
        subscriptionState: "cancelled",
      }),
    ).toBe("suspended");
  });

  it("returns 'restricted' when subscriptionState is restricted", () => {
    expect(
      mapEventsModuleAvailability({
        entitled: true,
        enabled: true,
        entitlementSource: "plan",
        entitlementEnded: false,
        subscriptionState: "restricted",
      }),
    ).toBe("restricted");
  });

  it("returns 'not_entitled' when not entitled", () => {
    expect(
      mapEventsModuleAvailability({
        entitled: false,
        enabled: false,
        entitlementSource: null,
        entitlementEnded: false,
        subscriptionState: null,
      }),
    ).toBe("not_entitled");
  });

  it("returns 'expired' when entitlement ended", () => {
    expect(
      mapEventsModuleAvailability({
        entitled: false,
        enabled: false,
        entitlementSource: "plan",
        entitlementEnded: true,
        subscriptionState: null,
      }),
    ).toBe("expired");
  });

  it("returns 'entitled_disabled' when entitled but disabled", () => {
    expect(
      mapEventsModuleAvailability({
        entitled: true,
        enabled: false,
        entitlementSource: "plan",
        entitlementEnded: false,
        subscriptionState: null,
      }),
    ).toBe("entitled_disabled");
  });

  it("returns 'trial' when entitled via trial", () => {
    expect(
      mapEventsModuleAvailability({
        entitled: true,
        enabled: true,
        entitlementSource: "trial",
        entitlementEnded: false,
        subscriptionState: null,
      }),
    ).toBe("trial");
  });

  it("returns 'enabled' when entitled, enabled, and on plan", () => {
    expect(
      mapEventsModuleAvailability({
        entitled: true,
        enabled: true,
        entitlementSource: "plan",
        entitlementEnded: false,
        subscriptionState: null,
      }),
    ).toBe("enabled");
  });
});
