import { describe, expect, it } from "vitest";

import { mapInvitationInspection } from "@/core/auth/invitation-state";
import {
  isTestIdentityEnabled,
  isTestIdentityFlagEnabled,
  isTestIdentityToken,
} from "@/core/auth/test-identity";

describe("mapInvitationInspection", () => {
  it("maps a pending payload", () => {
    expect(
      mapInvitationInspection({
        status: "pending",
        email: "new.editor@example.com",
        role: "content_editor",
        scope_type: "venue",
        venue_id: "00000000-0000-4000-8000-000000000201",
        venue_name: "Night Orchid",
      }),
    ).toMatchObject({
      status: "pending",
      email: "new.editor@example.com",
      role: "content_editor",
      scopeType: "venue",
      venueId: null,
      businessId: null,
      venueName: "Night Orchid",
    });
  });

  it.each(["invalid", "expired", "revoked", "accepted"] as const)(
    "maps %s without copying invitation fields",
    (status) => {
      expect(
        mapInvitationInspection({
          status,
          email: "hidden@example.com",
          role: "business_owner",
          venue_id: "00000000-0000-4000-8000-000000000201",
          venue_name: "Night Orchid",
        }),
      ).toEqual({
        status,
        email: null,
        role: null,
        scopeType: null,
        venueId: null,
        businessId: null,
        venueName: null,
        businessName: null,
        expiresAt: null,
      });
    },
  );

  it("treats unknown shapes as invalid without copying extra fields", () => {
    expect(mapInvitationInspection({ status: "nope", email: "a@b.c" })).toEqual(
      {
        status: "invalid",
        email: null,
        role: null,
        scopeType: null,
        venueId: null,
        businessId: null,
        venueName: null,
        businessName: null,
        expiresAt: null,
      },
    );
  });
});

describe("test identity cookie", () => {
  it("accepts only the allowlisted tokens", () => {
    expect(isTestIdentityToken("authenticated-no-access")).toBe(true);
    expect(isTestIdentityToken("authenticated-deactivated")).toBe(true);
    expect(isTestIdentityToken("platform-admin")).toBe(true);
    expect(isTestIdentityToken("platform-support")).toBe(true);
    expect(isTestIdentityToken('{"role":"platform_admin"}')).toBe(false);
  });

  it("requires test env, non-production Node, and the explicit flag", () => {
    expect(isTestIdentityEnabled("test", "development", true)).toBe(true);
    expect(isTestIdentityEnabled("test", "test", true)).toBe(true);
    expect(isTestIdentityEnabled("test", "development", false)).toBe(false);
    expect(isTestIdentityEnabled("local", "development", true)).toBe(false);
    expect(isTestIdentityEnabled("local", "development", false)).toBe(false);
    expect(isTestIdentityEnabled("test", "production", true)).toBe(false);
    expect(isTestIdentityEnabled("staging", "development", true)).toBe(false);
    expect(isTestIdentityEnabled("production", "development", true)).toBe(
      false,
    );
    expect(isTestIdentityEnabled("preview", "development", true)).toBe(false);
  });

  it("treats only 1 and true as the enable flag", () => {
    expect(isTestIdentityFlagEnabled("1")).toBe(true);
    expect(isTestIdentityFlagEnabled("true")).toBe(true);
    expect(isTestIdentityFlagEnabled("yes")).toBe(false);
    expect(isTestIdentityFlagEnabled("")).toBe(false);
    expect(isTestIdentityFlagEnabled(undefined)).toBe(false);
  });
});
