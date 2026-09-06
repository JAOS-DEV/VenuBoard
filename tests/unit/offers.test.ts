import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { encodeOfferCursor, isSafeOfferCursor } from "@/core/offers/cursor";
import {
  isPublicOfferLive,
  livePublicOffers,
  nextPublicOfferRefreshAt,
  msUntilOfferExpiry,
} from "@/core/offers/expiry";
import {
  materialOfferFieldsChanged,
  offerStateCopyKey,
  offerValidityLabel,
} from "@/core/offers/labels";
import { mapOffersModuleAvailability } from "@/core/offers/module-state";
import { publicVenueOffersPath } from "@/core/offers/public-path";
import {
  isOfferPubliclyEligible,
  mapPublicVenueOffers,
  publicOfferCopy,
} from "@/core/offers/public-map";
import {
  mapOfferRpcResult,
  normalizeOfferErrorCode,
} from "@/core/offers/result";
import {
  CreateOfferSchema,
  UpdateOffersSettingsSchema,
} from "@/core/offers/schema";
import {
  parseVenueLocalDateTime,
  venueInstantToLocalInput,
  venueLocalDateTimeToUtc,
} from "@/core/offers/timezone";
import { isRawInternalState } from "@/core/ui/status";

const validBase = {
  venueId: "00000000-0000-4000-8000-000000000101",
  titleEn: "  Lunch set  ",
  descriptionEn: "A fictional two-course lunch.",
  termsEn: "Informational only.",
  validFromLocal: "2026-09-06T12:00",
  validUntilLocal: "2026-09-13T12:00",
};

describe("offer input validation", () => {
  it("requires bounded English title, description and terms", () => {
    const parsed = CreateOfferSchema.safeParse(validBase);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.titleEn).toBe("Lunch set");
    }

    expect(
      CreateOfferSchema.safeParse({
        ...validBase,
        titleEn: "",
      }).success,
    ).toBe(false);

    expect(
      CreateOfferSchema.safeParse({
        ...validBase,
        titleEn: "A".repeat(121),
      }).success,
    ).toBe(false);

    expect(
      CreateOfferSchema.safeParse({
        ...validBase,
        termsEn: "T".repeat(4001),
      }).success,
    ).toBe(false);
  });

  it("requires Thai title, description and terms together", () => {
    expect(
      CreateOfferSchema.safeParse({
        ...validBase,
        titleTh: "ชุดอาหาร",
      }).success,
    ).toBe(false);

    expect(
      CreateOfferSchema.safeParse({
        ...validBase,
        titleTh: "ชุดอาหาร",
        descriptionTh: "คำอธิบาย",
        termsTh: "ข้อมูลเท่านั้น",
      }).success,
    ).toBe(true);
  });

  it("rejects remote media URLs and traversal", () => {
    expect(
      CreateOfferSchema.safeParse({
        ...validBase,
        mediaStoragePath: "https://example.com/x.png",
      }).success,
    ).toBe(false);
    expect(
      CreateOfferSchema.safeParse({
        ...validBase,
        mediaStoragePath: "venues/00000000-0000-4000-8000-000000000101/../x",
      }).success,
    ).toBe(false);
    expect(
      CreateOfferSchema.safeParse({
        ...validBase,
        mediaStoragePath:
          "venues/00000000-0000-4000-8000-000000000101/offers/card.jpg",
      }).success,
    ).toBe(true);
  });

  it("rejects out-of-range homepage preview counts", () => {
    const parsed = UpdateOffersSettingsSchema.safeParse({
      venueId: "venue-1",
      isEnabled: true,
      isPubliclyVisible: true,
      requireManagerApproval: false,
      homepagePreviewEnabled: true,
      homepagePreviewCount: 3,
      headingEn: "Offers",
    });
    expect(parsed.success).toBe(true);
    expect(
      UpdateOffersSettingsSchema.safeParse({
        venueId: "venue-1",
        isEnabled: true,
        isPubliclyVisible: true,
        requireManagerApproval: false,
        homepagePreviewEnabled: true,
        homepagePreviewCount: 99,
      }).success,
    ).toBe(false);
  });
});

describe("venue-local conversion", () => {
  it("parses venue-local input and round-trips Asia/Bangkok", () => {
    const local = parseVenueLocalDateTime("2026-09-06T18:30");
    expect(local).toEqual({
      year: 2026,
      month: 9,
      day: 6,
      hour: 18,
      minute: 30,
    });
    const utc = venueLocalDateTimeToUtc(local!, "Asia/Bangkok");
    expect(utc).not.toBeNull();
    expect(venueInstantToLocalInput(utc!, "Asia/Bangkok")).toBe(
      "2026-09-06T18:30",
    );
  });

  it("rejects malformed local strings", () => {
    expect(parseVenueLocalDateTime("2026-09-06 18:30")).toBeNull();
    expect(parseVenueLocalDateTime("2026-13-01T00:00")).toBeNull();
  });
});

describe("offer cursors", () => {
  it("encodes and accepts a stable cursor", () => {
    const cursor = encodeOfferCursor({
      sortAt: "2026-09-04T00:00:00.000Z",
      id: "00000000-0000-4000-8000-000000000d11",
    });
    expect(isSafeOfferCursor(cursor)).toBe(true);
    expect(isSafeOfferCursor(null)).toBe(true);
    expect(isSafeOfferCursor("not-a-cursor")).toBe(false);
  });
});

describe("offer public mapping", () => {
  it("hides unavailable payloads without leaking internals", () => {
    const hidden = mapPublicVenueOffers({ ok: true, available: false }, "en");
    expect(hidden.available).toBe(false);
    expect(hidden.items).toEqual([]);
    expect(JSON.stringify(hidden)).not.toContain("submitted_by");
    expect(JSON.stringify(hidden)).not.toContain("approved_at");
  });

  it("maps public items and drops incomplete rows", () => {
    const mapped = mapPublicVenueOffers(
      {
        ok: true,
        available: true,
        heading: "Offers",
        preview_enabled: true,
        preview_count: 3,
        timezone: "Asia/Bangkok",
        items: [
          {
            title: "Lunch set",
            description: "Two courses.",
            terms: "Informational only.",
            valid_from: "2026-09-01T00:00:00.000Z",
            valid_until: "2026-09-30T00:00:00.000Z",
            locale: "en",
            id: "should-not-copy",
            approved_at: "leak",
          },
          { title: "Incomplete" },
        ],
      },
      "th",
    );
    expect(mapped.available).toBe(true);
    expect(mapped.items).toHaveLength(1);
    expect(mapped.items[0]?.title).toBe("Lunch set");
    expect(mapped.items[0]).not.toHaveProperty("id");
    expect(mapped.items[0]).not.toHaveProperty("approved_at");
  });

  it("falls back to English when Thai is absent", () => {
    const copy = publicOfferCopy("th", {
      en: {
        title: "Lunch set",
        description: "Two courses.",
        terms: "Informational only.",
      },
    });
    expect(copy.locale).toBe("en");
    expect(copy.title).toBe("Lunch set");
  });
});

describe("validity and publication eligibility", () => {
  const now = Date.parse("2026-09-06T12:00:00.000Z");

  it("uses start-inclusive end-exclusive validity", () => {
    expect(
      isOfferPubliclyEligible({
        state: "published",
        scheduledFor: null,
        publishedAt: "2026-09-01T00:00:00.000Z",
        archivedAt: null,
        quarantinedAt: null,
        validFrom: "2026-09-06T12:00:00.000Z",
        validUntil: "2026-09-13T12:00:00.000Z",
        nowMs: now,
      }),
    ).toBe(true);
    expect(
      isOfferPubliclyEligible({
        state: "published",
        scheduledFor: null,
        publishedAt: "2026-09-01T00:00:00.000Z",
        archivedAt: null,
        quarantinedAt: null,
        validFrom: "2026-09-06T12:00:00.001Z",
        validUntil: "2026-09-13T12:00:00.000Z",
        nowMs: now,
      }),
    ).toBe(false);
    expect(
      isOfferPubliclyEligible({
        state: "published",
        scheduledFor: null,
        publishedAt: "2026-09-01T00:00:00.000Z",
        archivedAt: null,
        quarantinedAt: null,
        validFrom: "2026-09-01T00:00:00.000Z",
        validUntil: "2026-09-06T12:00:00.000Z",
        nowMs: now,
      }),
    ).toBe(false);
  });

  it("hides future, expired, draft, archived and quarantined offers", () => {
    expect(
      isOfferPubliclyEligible({
        state: "published",
        scheduledFor: null,
        publishedAt: "2026-09-01T00:00:00.000Z",
        archivedAt: null,
        quarantinedAt: null,
        validFrom: "2026-09-10T00:00:00.000Z",
        validUntil: "2026-09-20T00:00:00.000Z",
        nowMs: now,
      }),
    ).toBe(false);
    expect(
      isOfferPubliclyEligible({
        state: "draft",
        scheduledFor: null,
        publishedAt: null,
        archivedAt: null,
        quarantinedAt: null,
        validFrom: "2026-09-01T00:00:00.000Z",
        validUntil: "2026-09-20T00:00:00.000Z",
        nowMs: now,
      }),
    ).toBe(false);
    expect(
      isOfferPubliclyEligible({
        state: "published",
        scheduledFor: null,
        publishedAt: "2026-09-01T00:00:00.000Z",
        archivedAt: "2026-09-05T00:00:00.000Z",
        quarantinedAt: null,
        validFrom: "2026-09-01T00:00:00.000Z",
        validUntil: "2026-09-20T00:00:00.000Z",
        nowMs: now,
      }),
    ).toBe(false);
  });

  it("derives upcoming, active and expired labels from timestamps", () => {
    expect(
      offerValidityLabel(
        "2026-09-10T00:00:00.000Z",
        "2026-09-20T00:00:00.000Z",
        now,
      ),
    ).toBe("upcoming");
    expect(
      offerValidityLabel(
        "2026-09-01T00:00:00.000Z",
        "2026-09-20T00:00:00.000Z",
        now,
      ),
    ).toBe("active");
    expect(
      offerValidityLabel(
        "2026-08-01T00:00:00.000Z",
        "2026-09-01T00:00:00.000Z",
        now,
      ),
    ).toBe("expired");
  });
});

describe("approval invalidation mapping", () => {
  it("treats title, description, terms, translations and validity as material", () => {
    const before = {
      titleEn: "A",
      descriptionEn: "B",
      termsEn: "C",
      titleTh: "",
      descriptionTh: "",
      termsTh: "",
      validFromLocal: "2026-09-06T12:00",
      validUntilLocal: "2026-09-13T12:00",
    };
    expect(materialOfferFieldsChanged(before, before)).toBe(false);
    expect(
      materialOfferFieldsChanged(before, { ...before, titleEn: "A2" }),
    ).toBe(true);
    expect(
      materialOfferFieldsChanged(before, {
        ...before,
        validUntilLocal: "2026-09-14T12:00",
      }),
    ).toBe(true);
    expect(
      materialOfferFieldsChanged(before, { ...before, titleTh: "ก" }),
    ).toBe(true);
  });
});

describe("client expiry helper", () => {
  it("returns the earliest valid_until for refresh", () => {
    const now = Date.parse("2026-09-06T12:00:00.000Z");
    expect(msUntilOfferExpiry("2026-09-06T12:00:05.000Z", now)).toBe(5000);
    const next = nextPublicOfferRefreshAt(
      [
        {
          title: "Soon",
          description: "d",
          terms: "t",
          validFrom: "2026-09-01T00:00:00.000Z",
          validUntil: "2026-09-06T12:00:10.000Z",
          locale: "en",
        },
        {
          title: "Later",
          description: "d",
          terms: "t",
          validFrom: "2026-09-01T00:00:00.000Z",
          validUntil: "2026-09-06T13:00:00.000Z",
          locale: "en",
        },
      ],
      now,
    );
    expect(next).toBe(now + 10_000);
  });

  it("hides offers at the exclusive valid_until instant", () => {
    const now = Date.parse("2026-09-06T12:00:00.000Z");
    expect(isPublicOfferLive("2026-09-06T12:00:00.001Z", now)).toBe(true);
    expect(isPublicOfferLive("2026-09-06T12:00:00.000Z", now)).toBe(false);
    expect(
      livePublicOffers(
        [
          {
            title: "Live",
            description: "d",
            terms: "t",
            validFrom: "2026-09-01T00:00:00.000Z",
            validUntil: "2026-09-06T12:00:01.000Z",
            locale: "en" as const,
          },
          {
            title: "Gone",
            description: "d",
            terms: "t",
            validFrom: "2026-09-01T00:00:00.000Z",
            validUntil: "2026-09-06T12:00:00.000Z",
            locale: "en" as const,
          },
        ],
        now,
      ).map((item) => item.title),
    ).toEqual(["Live"]);
  });
});

describe("offer errors and labels", () => {
  it("normalises unknown codes and maps RPC failures", () => {
    expect(normalizeOfferErrorCode("nope")).toBe("unavailable");
    expect(mapOfferRpcResult({ ok: false, code: "forbidden" })).toEqual({
      ok: false,
      code: "forbidden",
    });
    expect(offerStateCopyKey("pending_approval")).toBe("pending");
    expect(isRawInternalState("pending_approval")).toBe(true);
  });

  it("maps module availability including restricted and not entitled", () => {
    expect(
      mapOffersModuleAvailability({
        entitled: false,
        enabled: true,
        entitlementSource: "plan",
        entitlementEnded: false,
        subscriptionState: "active",
      }),
    ).toBe("not_entitled");
    expect(
      mapOffersModuleAvailability({
        entitled: true,
        enabled: true,
        entitlementSource: "plan",
        entitlementEnded: false,
        subscriptionState: "restricted",
      }),
    ).toBe("restricted");
  });
});

describe("public path and safe rendering", () => {
  it("accepts venue slugs and rejects traversal", () => {
    expect(publicVenueOffersPath("harbor-light")).toBe(
      "/v/harbor-light/offers",
    );
    expect(publicVenueOffersPath("../admin")).toBeNull();
  });

  it("does not render executable HTML in public offer cards", () => {
    const card = readFileSync(
      "src/components/offers/public-offer-card.tsx",
      "utf8",
    );
    expect(card).not.toContain("dangerouslySetInnerHTML");
    expect(card).toContain("whitespace-pre-wrap");
    expect(card).toContain("line-clamp-2");
  });

  it("uses a labelled Edit/View button on the admin list", () => {
    const source = readFileSync(
      "src/app/[locale]/admin/offers/page.tsx",
      "utf8",
    );
    expect(source).toContain('variant="outline"');
    expect(source).toContain("min-h-11");
    expect(source).toContain("ResponsiveFilterControls");
    expect(source).not.toContain("dangerouslySetInnerHTML");
  });
});
