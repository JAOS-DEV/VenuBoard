import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { encodeFeedCursor, isSafeFeedCursor } from "@/core/feed/cursor";
import { publicVenueUpdatesPath } from "@/core/feed/public-path";
import {
  feedStateCopyKey,
  feedTypeCopyKey,
  formatFeedPublicDate,
} from "@/core/feed/labels";
import { mapFeedModuleAvailability } from "@/core/feed/module-state";
import {
  isFeedPostPubliclyEligible,
  mapPublicVenueFeed,
} from "@/core/feed/public-map";
import { normalizeFeedErrorCode, mapFeedRpcResult } from "@/core/feed/result";
import {
  CreateFeedPostSchema,
  UpdateFeedSettingsSchema,
} from "@/core/feed/schema";
import { isRawInternalState } from "@/core/ui/status";

describe("feed input validation", () => {
  it("requires bounded English title and body", () => {
    const parsed = CreateFeedPostSchema.safeParse({
      venueId: "venue-1",
      postType: "update",
      titleEn: "  Kitchen hours  ",
      bodyEn: "Open late.",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.titleEn).toBe("Kitchen hours");
    }

    expect(
      CreateFeedPostSchema.safeParse({
        venueId: "venue-1",
        titleEn: "",
        bodyEn: "Body",
      }).success,
    ).toBe(false);

    expect(
      CreateFeedPostSchema.safeParse({
        venueId: "venue-1",
        titleEn: "A".repeat(121),
        bodyEn: "Body",
      }).success,
    ).toBe(false);

    expect(
      CreateFeedPostSchema.safeParse({
        venueId: "venue-1",
        postType: "offer",
        titleEn: "Title",
        bodyEn: "Body",
      }).success,
    ).toBe(false);
  });

  it("rejects executable settings keys via bounded schema", () => {
    const parsed = UpdateFeedSettingsSchema.safeParse({
      venueId: "venue-1",
      isEnabled: true,
      isPubliclyVisible: true,
      requireManagerApproval: false,
      homepagePreviewEnabled: true,
      homepagePreviewCount: 3,
      horizonDays: 365,
      displayDensity: "comfortable",
      headingEn: "Updates",
    });
    expect(parsed.success).toBe(true);
    expect(
      UpdateFeedSettingsSchema.safeParse({
        venueId: "venue-1",
        isEnabled: true,
        isPubliclyVisible: true,
        requireManagerApproval: false,
        homepagePreviewEnabled: true,
        homepagePreviewCount: 99,
        horizonDays: 365,
        displayDensity: "comfortable",
      }).success,
    ).toBe(false);
  });
});

describe("feed cursors", () => {
  it("encodes and accepts a stable cursor", () => {
    const cursor = encodeFeedCursor({
      pinned: true,
      sortAt: "2026-09-04T00:00:00.000Z",
      id: "00000000-0000-4000-8000-000000000501",
    });
    expect(isSafeFeedCursor(cursor)).toBe(true);
    expect(isSafeFeedCursor(null)).toBe(true);
    expect(isSafeFeedCursor("not-a-cursor")).toBe(false);
    expect(isSafeFeedCursor("%%%")).toBe(false);
  });

  it("accepts PostgreSQL-style base64 cursors that include newlines", () => {
    const compact = encodeFeedCursor({
      pinned: false,
      sortAt: "2026-08-25T12:00:00.000Z",
      id: "00000000-0000-4000-8000-00000000051c",
    });
    const wrapped = `${compact.slice(0, 76)}\n${compact.slice(76)}`;
    expect(isSafeFeedCursor(wrapped)).toBe(true);
  });
});

describe("feed public mapping", () => {
  it("hides unavailable payloads without leaking internals", () => {
    const hidden = mapPublicVenueFeed({ ok: true, available: false }, "en");
    expect(hidden.available).toBe(false);
    expect(hidden.items).toEqual([]);
    expect(JSON.stringify(hidden)).not.toContain("submitted_by");
  });

  it("maps public items and drops incomplete rows", () => {
    const mapped = mapPublicVenueFeed(
      {
        ok: true,
        available: true,
        heading: "Updates",
        preview_enabled: true,
        preview_count: 3,
        items: [
          {
            title: "Doors at ten",
            body: "Bring ID.",
            post_type: "notice",
            published_at: "2026-09-04T10:00:00.000Z",
            is_pinned: true,
            locale: "en",
            submitted_by: "should-not-copy",
          },
          { title: "Incomplete" },
        ],
      },
      "th",
    );
    expect(mapped.available).toBe(true);
    expect(mapped.items).toHaveLength(1);
    expect(mapped.items[0]?.title).toBe("Doors at ten");
    expect(mapped.items[0]?.postType).toBe("notice");
    expect(mapped.items[0]).not.toHaveProperty("submitted_by");
  });
});

describe("scheduled visibility", () => {
  const now = Date.parse("2026-09-04T12:00:00.000Z");

  it("hides future scheduled posts and shows due scheduled posts", () => {
    expect(
      isFeedPostPubliclyEligible({
        state: "scheduled",
        scheduledFor: "2026-09-05T12:00:00.000Z",
        publishedAt: null,
        archivedAt: null,
        quarantinedAt: null,
        nowMs: now,
      }),
    ).toBe(false);
    expect(
      isFeedPostPubliclyEligible({
        state: "scheduled",
        scheduledFor: "2026-09-04T11:00:00.000Z",
        publishedAt: "2026-09-04T11:00:00.000Z",
        archivedAt: null,
        quarantinedAt: null,
        nowMs: now,
      }),
    ).toBe(true);
  });

  it("hides drafts, archived and quarantined posts", () => {
    expect(
      isFeedPostPubliclyEligible({
        state: "draft",
        scheduledFor: null,
        publishedAt: null,
        archivedAt: null,
        quarantinedAt: null,
        nowMs: now,
      }),
    ).toBe(false);
    expect(
      isFeedPostPubliclyEligible({
        state: "published",
        scheduledFor: null,
        publishedAt: "2026-09-04T11:00:00.000Z",
        archivedAt: "2026-09-04T11:30:00.000Z",
        quarantinedAt: null,
        nowMs: now,
      }),
    ).toBe(false);
  });
});

describe("feed labels and errors", () => {
  it("maps workflow states to human keys", () => {
    expect(feedStateCopyKey("pending_approval")).toBe("pending");
    expect(feedTypeCopyKey("announcement")).toBe("typeAnnouncement");
    expect(formatFeedPublicDate("2026-09-04T00:00:00.000Z", "en")).toMatch(
      /Sep/,
    );
    expect(isRawInternalState("pending_approval")).toBe(true);
    expect(isRawInternalState("Draft")).toBe(false);
  });

  it("normalises unknown RPC codes", () => {
    expect(normalizeFeedErrorCode("nope")).toBe("unavailable");
    expect(mapFeedRpcResult({ ok: false, code: "forbidden" })).toEqual({
      ok: false,
      code: "forbidden",
    });
    expect(
      mapFeedRpcResult({ ok: false, message: "relation does not exist" }),
    ).toEqual({
      ok: false,
      code: "unavailable",
    });
  });
});

describe("feed module availability", () => {
  it("distinguishes entitlement and subscription states", () => {
    expect(
      mapFeedModuleAvailability({
        entitled: false,
        enabled: true,
        entitlementSource: null,
        entitlementEnded: false,
        subscriptionState: "active",
      }),
    ).toBe("not_entitled");
    expect(
      mapFeedModuleAvailability({
        entitled: true,
        enabled: false,
        entitlementSource: "plan",
        entitlementEnded: false,
        subscriptionState: "active",
      }),
    ).toBe("entitled_disabled");
    expect(
      mapFeedModuleAvailability({
        entitled: true,
        enabled: true,
        entitlementSource: "plan",
        entitlementEnded: false,
        subscriptionState: "restricted",
      }),
    ).toBe("restricted");
  });
});

describe("plain-text rendering", () => {
  it("does not use dangerouslySetInnerHTML in feed UI", () => {
    const files = [
      "src/components/feed/public-feed-card.tsx",
      "src/components/feed/public-feed-preview.tsx",
      "src/components/feed/public-feed-list.tsx",
      "src/components/feed/feed-admin-panel.tsx",
    ];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toContain("dangerouslySetInnerHTML");
    }
  });
});

describe("feed public destination path", () => {
  it("builds a locale-relative public updates path only from a safe venue slug", () => {
    expect(publicVenueUpdatesPath("harbor-light")).toBe(
      "/v/harbor-light/updates",
    );
    expect(publicVenueUpdatesPath("harbor-light")).not.toContain(
      "00000000-0000-4000-8000-000000000501",
    );
    expect(publicVenueUpdatesPath("")).toBeNull();
    expect(publicVenueUpdatesPath("../evil")).toBeNull();
    expect(publicVenueUpdatesPath("Harbor Light")).toBeNull();
    expect(publicVenueUpdatesPath("harbor/light")).toBeNull();
    expect(publicVenueUpdatesPath("a".repeat(81))).toBeNull();
  });
});

describe("feed admin filters and public destination", () => {
  it("does not use sideways-scrolling filter rows", () => {
    const filterBar = readFileSync(
      "src/components/patterns/filter-bar.tsx",
      "utf8",
    );
    expect(filterBar).toContain("flex flex-wrap gap-2");
    expect(filterBar).not.toContain("overflow-x-auto");
    expect(filterBar).not.toContain("overflow-x-scroll");

    const controls = readFileSync(
      "src/components/patterns/responsive-filter-controls.tsx",
      "utf8",
    );
    expect(controls).toContain("md:hidden");
    expect(controls).toContain("hidden space-y-3 md:block");
    expect(controls).toContain("<Label htmlFor={field.id}>");
    expect(controls).toContain("h-11");
    expect(controls).not.toContain("overflow-x-auto");

    const listPage = readFileSync(
      "src/app/[locale]/admin/feed/page.tsx",
      "utf8",
    );
    expect(listPage).toContain("ResponsiveFilterControls");
    expect(listPage).toContain('t("filterStatus")');
    expect(listPage).toContain('t("filterType")');
    expect(listPage).toContain("publicVenueUpdatesPath(current.slug)");
    expect(listPage).toContain('t("viewPublic")');
  });

  it("exposes a published-post public destination without a post id", () => {
    const panel = readFileSync(
      "src/components/feed/feed-admin-panel.tsx",
      "utf8",
    );
    expect(panel).toContain("publicUpdatesHref");
    expect(panel).toContain('t("viewPublic")');
    expect(panel).toContain('state === "published"');
    expect(panel).not.toMatch(/href=\{`\/v\/\$\{.*post\.id/);
  });
});

describe("venue-admin navigation breakpoint", () => {
  it("hides the bottom bar at md and does not treat CSS as authorisation", () => {
    const mobile = readFileSync(
      "src/components/patterns/mobile-navigation.tsx",
      "utf8",
    );
    expect(mobile).toContain("md:hidden");
    expect(mobile).toContain('aria-label={t("primary")}');

    const chrome = readFileSync(
      "src/components/patterns/compact-chrome.tsx",
      "utf8",
    );
    expect(chrome).toContain("hidden md:block");
    expect(chrome).toContain('aria-label={surfacesLabel ?? t("surfaces")}');

    const surfaces = readFileSync("src/core/authz/surfaces.ts", "utf8");
    expect(surfaces).toContain("UX-only navigation flags");
    expect(surfaces).toContain("venueAdminNavAccess");
    expect(surfaces).toContain("hasFeedAccess");
  });
});

describe("feed admin edit action", () => {
  it("uses a labelled Button link rather than a text-only card click", () => {
    const source = readFileSync("src/app/[locale]/admin/feed/page.tsx", "utf8");
    expect(source).toContain('variant="outline"');
    expect(source).toContain("min-h-11");
    expect(source).toContain("w-full");
    expect(source).toContain("canOpenPost");
    expect(source).toContain("Pencil");
    expect(source).toContain('aria-label={`${t("edit")}: ${title}`}');
    expect(source).not.toContain("dangerouslySetInnerHTML");
    expect(source).not.toMatch(/<Link[^>]*>\s*<li/);
    expect(source).toContain('<p className="mt-1 font-medium">{title}</p>');
  });
});
