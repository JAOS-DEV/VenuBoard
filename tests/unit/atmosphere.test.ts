import { describe, expect, it } from "vitest";

import {
  ATMOSPHERE_STATES,
  clampAtmosphereExpiryMinutes,
  expiresAtFromMinutes,
  isAtmosphereCurrent,
  isAtmosphereState,
  remainingMinutes,
} from "@/core/atmosphere/constants";
import { atmosphereCopyKey } from "@/core/atmosphere/labels";
import { mapAtmosphereModuleAvailability } from "@/core/atmosphere/module-state";
import { mapPublicAtmosphere } from "@/core/atmosphere/public-map";
import {
  mapAtmosphereRpcResult,
  normalizeAtmosphereErrorCode,
} from "@/core/atmosphere/result";
import { SetAtmosphereSchema } from "@/core/atmosphere/schema";
import { isRawInternalState } from "@/core/ui/status";
import { atmosphereFrontOfHouseProvenConditions } from "@/core/authz/scope";

describe("atmosphere vocabulary", () => {
  it("accepts only the controlled states", () => {
    expect(ATMOSPHERE_STATES).toEqual([
      "calm",
      "social",
      "lively",
      "high_energy",
    ]);
    expect(isAtmosphereState("lively")).toBe(true);
    expect(isAtmosphereState("packed")).toBe(false);
    expect(atmosphereCopyKey("high_energy")).toBe("highEnergy");
    expect(atmosphereCopyKey(null)).toBe("none");
  });
});

describe("atmosphere expiry", () => {
  it("clamps invalid minutes to the default", () => {
    expect(clampAtmosphereExpiryMinutes(120)).toBe(120);
    expect(clampAtmosphereExpiryMinutes(15)).toBe(120);
    expect(clampAtmosphereExpiryMinutes(400)).toBe(120);
  });

  it("treats expiry at query time", () => {
    const now = new Date("2026-09-03T12:00:00.000Z");
    const expires = expiresAtFromMinutes(now, 30);
    expect(expires.toISOString()).toBe("2026-09-03T12:30:00.000Z");
    expect(isAtmosphereCurrent(expires, now)).toBe(true);
    expect(
      isAtmosphereCurrent(expires, new Date("2026-09-03T12:31:00.000Z")),
    ).toBe(false);
    expect(remainingMinutes(expires, now)).toBe(30);
  });
});

describe("atmosphere public mapping", () => {
  it("hides ineligible payloads without leaking internals", () => {
    expect(mapPublicAtmosphere({ ok: true, available: false })).toEqual({
      available: false,
      heading: null,
      statusKey: null,
      presentation: "card",
      freshness: null,
    });
    expect(
      mapPublicAtmosphere({
        ok: true,
        available: true,
        status_key: "packed",
      }).available,
    ).toBe(false);
  });

  it("maps an eligible public card", () => {
    expect(
      mapPublicAtmosphere({
        ok: true,
        available: true,
        heading: "Right now at Harbor Light",
        status_key: "lively",
        presentation: "card",
        freshness: "current",
      }),
    ).toEqual({
      available: true,
      heading: "Right now at Harbor Light",
      statusKey: "lively",
      presentation: "card",
      freshness: "current",
    });
  });
});

describe("atmosphere module state", () => {
  it("maps restricted and not entitled without raw strings", () => {
    expect(
      mapAtmosphereModuleAvailability({
        entitled: false,
        enabled: true,
        entitlementSource: "plan",
        entitlementEnded: false,
        subscriptionState: "active",
      }),
    ).toBe("not_entitled");
    expect(
      mapAtmosphereModuleAvailability({
        entitled: true,
        enabled: true,
        entitlementSource: "plan",
        entitlementEnded: false,
        subscriptionState: "restricted",
      }),
    ).toBe("restricted");
    expect(isRawInternalState("not_entitled")).toBe(true);
  });
});

describe("atmosphere errors and input", () => {
  it("normalises unknown codes", () => {
    expect(normalizeAtmosphereErrorCode("duplicate_key")).toBe("unavailable");
    expect(mapAtmosphereRpcResult({ ok: false, code: "forbidden" })).toEqual({
      ok: false,
      code: "forbidden",
    });
  });

  it("rejects invalid set payloads", () => {
    expect(
      SetAtmosphereSchema.safeParse({
        venueId: "00000000-0000-4000-8000-000000000101",
        state: "packed",
        expiryMinutes: 120,
      }).success,
    ).toBe(false);
    expect(
      SetAtmosphereSchema.safeParse({
        venueId: "00000000-0000-4000-8000-000000000101",
        state: "calm",
        expiryMinutes: 15,
      }).success,
    ).toBe(false);
    expect(
      SetAtmosphereSchema.safeParse({
        venueId: "00000000-0000-4000-8000-000000000101",
        state: "social",
        expiryMinutes: 60,
      }).success,
    ).toBe(true);
  });
});

describe("C6 proven conditions", () => {
  it("never trusts an unproven editor or staff cell", () => {
    expect(
      atmosphereFrontOfHouseProvenConditions("content_editor", false),
    ).toEqual([]);
    expect(
      atmosphereFrontOfHouseProvenConditions("content_editor", true),
    ).toEqual(["content_editor:manage_atmosphere"]);
    expect(
      atmosphereFrontOfHouseProvenConditions("business_owner", true),
    ).toEqual([]);
  });
});
