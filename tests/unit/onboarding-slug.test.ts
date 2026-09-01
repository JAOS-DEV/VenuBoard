import { describe, expect, it } from "vitest";

import { normalizeVenueSlug, slugRejectReason } from "@/core/onboarding/slug";

describe("normalizeVenueSlug", () => {
  it("lowercases and strips invalid characters", () => {
    expect(normalizeVenueSlug(" Lotus Pier ")).toBe("lotus-pier");
    expect(normalizeVenueSlug("Lotus--Pier")).toBe("lotus-pier");
    expect(normalizeVenueSlug("-lotus-")).toBe("lotus");
  });

  it("rejects empty, overlong, and malformed values", () => {
    expect(normalizeVenueSlug("")).toBeNull();
    expect(normalizeVenueSlug("---")).toBeNull();
    expect(normalizeVenueSlug("a".repeat(65))).toBeNull();
  });
});

describe("slugRejectReason", () => {
  it("reports reserved and invalid slugs", () => {
    expect(slugRejectReason("admin", ["admin", "platform"])).toBe("reserved");
    expect(slugRejectReason("bad--slug", [])).toBeNull();
    expect(slugRejectReason("---", [])).toBe("invalid");
    expect(slugRejectReason("lotus-pier", ["admin"])).toBeNull();
  });
});
