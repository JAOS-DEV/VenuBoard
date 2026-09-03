import { describe, expect, it } from "vitest";

import { mapPublicVenueEvents } from "@/core/events/public-map";

describe("mapPublicVenueEvents", () => {
  it("maps available=false payload correctly", () => {
    const result = mapPublicVenueEvents({ ok: true, available: false }, "en");
    expect(result.available).toBe(false);
    expect(result.ok).toBe(true);
    expect(result.items).toEqual([]);
    expect(result.heading).toBeNull();
  });

  it("maps null payload as unavailable", () => {
    const result = mapPublicVenueEvents(null, "en");
    expect(result.available).toBe(false);
  });

  it("maps items correctly with locale fallback", () => {
    const payload = {
      ok: true,
      available: true,
      heading: "Tonight",
      locale: "en",
      timezone: "Asia/Bangkok",
      default_display: "calendar_and_list",
      show_past_archive: false,
      items: [
        {
          id: "00000000-0000-4000-8000-000000000405",
          starts_at: "2026-04-10T15:00:00.000Z",
          ends_at: "2026-04-10T17:00:00.000Z",
          timezone: "Asia/Bangkok",
          is_all_day: false,
          title: "Orchid Night",
          summary: "A great night",
          description: null,
          cta_label: "Get tickets",
          locale: "en",
        },
      ],
    };

    const result = mapPublicVenueEvents(payload, "en");
    expect(result.available).toBe(true);
    expect(result.items).toHaveLength(1);
    const item = result.items[0]!;
    expect(item.id).toBe("00000000-0000-4000-8000-000000000405");
    expect(item.title).toBe("Orchid Night");
    expect(item.summary).toBe("A great night");
    expect(item.ctaLabel).toBe("Get tickets");
    expect(item.locale).toBe("en");
  });

  it("filters out items with missing required fields", () => {
    const payload = {
      ok: true,
      available: true,
      heading: null,
      locale: "en",
      timezone: "UTC",
      default_display: "upcoming_list",
      show_past_archive: false,
      items: [
        // Missing title
        {
          id: "some-id",
          starts_at: "2026-01-01T00:00:00Z",
          ends_at: "2026-01-01T02:00:00Z",
          timezone: "UTC",
          is_all_day: false,
          // title missing
        },
        // Valid item
        {
          id: "valid-id",
          starts_at: "2026-01-02T00:00:00Z",
          ends_at: "2026-01-02T02:00:00Z",
          timezone: "UTC",
          is_all_day: false,
          title: "Valid Event",
        },
      ],
    };

    const result = mapPublicVenueEvents(payload, "en");
    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.id).toBe("valid-id");
  });

  it("no internal fields surfaced (approval_status, rejection_reason, etc.)", () => {
    const payload = {
      ok: true,
      available: true,
      heading: null,
      locale: "en",
      timezone: "UTC",
      default_display: "upcoming_list",
      show_past_archive: false,
      items: [
        {
          id: "internal-test",
          starts_at: "2026-01-01T00:00:00Z",
          ends_at: "2026-01-01T02:00:00Z",
          timezone: "UTC",
          is_all_day: false,
          title: "Test",
          approval_status: "approved", // should be stripped
          rejection_reason: "none", // should be stripped
          actor_user_id: "some-id", // should be stripped
          created_by: "some-id", // should be stripped
          updated_by: "some-id", // should be stripped
        },
      ],
    };

    const result = mapPublicVenueEvents(payload, "en");
    expect(result.items).toHaveLength(1);
    const item = result.items[0]! as unknown as Record<string, unknown>;
    expect(item).not.toHaveProperty("approval_status");
    expect(item).not.toHaveProperty("rejection_reason");
    expect(item).not.toHaveProperty("actor_user_id");
    expect(item).not.toHaveProperty("created_by");
    expect(item).not.toHaveProperty("updated_by");
  });

  it("maps defaultDisplay to upcoming_list when payload says so", () => {
    const payload = {
      ok: true,
      available: true,
      heading: null,
      locale: "en",
      timezone: "UTC",
      default_display: "upcoming_list",
      show_past_archive: false,
      items: [],
    };
    const result = mapPublicVenueEvents(payload, "en");
    expect(result.defaultDisplay).toBe("upcoming_list");
  });

  it("maps Thai locale correctly", () => {
    const payload = {
      ok: true,
      available: true,
      heading: "หัวข้อ",
      locale: "th",
      timezone: "Asia/Bangkok",
      default_display: "calendar_and_list",
      show_past_archive: true,
      items: [],
    };
    const result = mapPublicVenueEvents(payload, "th");
    expect(result.locale).toBe("th");
    expect(result.heading).toBe("หัวข้อ");
    expect(result.showPastArchive).toBe(true);
  });
});
