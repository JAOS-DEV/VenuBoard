import { describe, expect, it } from "vitest";

import { publicDisplayInitials } from "@/core/staff-presence/initials";
import {
  actorOwnsConsentedProfile,
  actorOwnsStaffProfile,
} from "@/core/staff-presence/ownership";
import {
  clampPresenceExpiryHours,
  effectivePresenceState,
  presenceExpiresAt,
} from "@/core/staff-presence/expiry";
import { sortStaffCarousel } from "@/core/staff-presence/ordering";
import {
  consentHidesPublicProfile,
  isPublicStaffProfileEligible,
  shouldIncludeInPresentOnlyMode,
} from "@/core/staff-presence/eligibility";
import {
  deactivationResetsPresence,
  mapStaffModuleAvailability,
  restoredStaffSafeState,
} from "@/core/staff-presence/module-state";
import { normalizeStaffErrorCode } from "@/core/staff-presence/result";
import { normalizeStaffTranslation } from "@/core/staff-presence/translations";
import { mapPublicStaffCarousel } from "@/core/staff-presence/public-map";
import { createStaffInputSchema } from "@/core/staff-presence/schema";

describe("staff presence helpers", () => {
  it("builds initials from the public display name", () => {
    expect(publicDisplayInitials("Mina Cole")).toBe("MC");
    expect(publicDisplayInitials("nok")).toBe("N");
    expect(publicDisplayInitials("  ")).toBe("?");
  });

  it("clamps expiry hours and treats expired present as not_present", () => {
    expect(clampPresenceExpiryHours(0)).toBe(1);
    expect(clampPresenceExpiryHours(48)).toBe(24);
    const marked = new Date("2026-09-01T00:00:00.000Z");
    expect(presenceExpiresAt(marked, 12).toISOString()).toBe(
      "2026-09-01T12:00:00.000Z",
    );
    expect(
      effectivePresenceState(
        "present",
        "2026-08-01T00:00:00.000Z",
        new Date("2026-09-01T00:00:00.000Z"),
      ),
    ).toBe("not_present");
    expect(
      effectivePresenceState(
        "present",
        "2099-01-01T00:00:00.000Z",
        new Date("2026-09-01T00:00:00.000Z"),
      ),
    ).toBe("present");
  });

  it("orders carousel rows deterministically", () => {
    const rows = [
      { publicId: "b", displayName: "Zed", displayOrder: 2 },
      { publicId: "a", displayName: "Amy", displayOrder: 2 },
      { publicId: "c", displayName: "Bo", displayOrder: 1 },
    ];
    expect(
      sortStaffCarousel(rows, "display_order").map((row) => row.publicId),
    ).toEqual(["c", "a", "b"]);
    expect(
      sortStaffCarousel(rows, "name").map((row) => row.displayName),
    ).toEqual(["Amy", "Bo", "Zed"]);
  });

  it("requires every public eligibility gate", () => {
    const eligible = isPublicStaffProfileEligible({
      venuePublished: true,
      moduleEntitled: true,
      moduleEnabled: true,
      modulePubliclyVisible: true,
      staffActive: true,
      assignmentActive: true,
      publicationPublished: true,
      consentState: "granted",
      quarantined: false,
      venuePubliclyVisible: true,
    });
    expect(eligible).toBe(true);
    expect(
      isPublicStaffProfileEligible({
        venuePublished: true,
        moduleEntitled: true,
        moduleEnabled: true,
        modulePubliclyVisible: true,
        staffActive: true,
        assignmentActive: true,
        publicationPublished: true,
        consentState: "withdrawn",
        quarantined: false,
        venuePubliclyVisible: true,
      }),
    ).toBe(false);
    expect(consentHidesPublicProfile("pending")).toBe(true);
    expect(shouldIncludeInPresentOnlyMode(true, "not_present")).toBe(false);
  });

  it("maps module and restoration states", () => {
    expect(
      mapStaffModuleAvailability({
        entitled: false,
        enabled: false,
        entitlementSource: null,
        entitlementEnded: false,
        subscriptionState: "active",
      }),
    ).toBe("not_entitled");
    expect(
      mapStaffModuleAvailability({
        entitled: true,
        enabled: false,
        entitlementSource: "plan",
        entitlementEnded: false,
        subscriptionState: "active",
      }),
    ).toBe("entitled_disabled");
    expect(restoredStaffSafeState()).toEqual({
      status: "active",
      publicationState: "draft",
      consentState: "pending",
      presenceState: "not_present",
    });
    expect(deactivationResetsPresence()).toBe("not_present");
  });

  it("normalises translation fallback and generic errors", () => {
    expect(
      normalizeStaffTranslation("th", { en: "Hello", th: " สวัสดี " }),
    ).toBe("สวัสดี");
    expect(normalizeStaffTranslation("th", { en: "Hello" })).toBe("Hello");
    expect(normalizeStaffErrorCode("forbidden")).toBe("forbidden");
    expect(normalizeStaffErrorCode("SQLERRM boom")).toBe("unavailable");
  });

  it("maps public RPC payloads without private fields", () => {
    const mapped = mapPublicStaffCarousel(
      {
        ok: true,
        available: true,
        heading: "Team on the floor",
        display_mode: "all_published",
        items: [
          {
            public_id: "p1",
            display_name: "Mina Cole",
            title: "Host",
            bio: "Harbour-side host",
            presence_state: "present",
          },
        ],
        venue: {
          name: "Harbor Light",
          slug: "harbor-light",
          content_classification: "general",
        },
      },
      "en",
    );
    expect(mapped.items[0]?.initials).toBe("MC");
    expect(JSON.stringify(mapped)).not.toContain("internal");
    expect(JSON.stringify(mapped)).not.toContain("user_id");
  });

  it("treats linked consented assignments as own presence only", () => {
    const row = {
      linkedUserId: "user-1",
      consentState: "granted",
      staffStatus: "active",
      assignmentStatus: "active",
    };
    expect(actorOwnsConsentedProfile("user-1", row)).toBe(true);
    expect(actorOwnsConsentedProfile("user-2", row)).toBe(false);
    expect(
      actorOwnsConsentedProfile("user-1", { ...row, consentState: "pending" }),
    ).toBe(false);
    expect(actorOwnsStaffProfile("user-1", "user-1")).toBe(true);
    expect(actorOwnsStaffProfile("user-1", null)).toBe(false);
  });

  it("rejects published profiles without granted consent at the form boundary", () => {
    const parsed = createStaffInputSchema.safeParse({
      venueId: "00000000-0000-4000-8000-000000000101",
      internalDisplayName: "Internal",
      publicDisplayName: "Public",
      publicationState: "published",
      consentState: "pending",
    });
    expect(parsed.success).toBe(false);
  });
});
