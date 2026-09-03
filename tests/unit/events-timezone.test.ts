import { describe, expect, it } from "vitest";

import {
  addDaysToDateOnly,
  formatVenueDateTimeRange,
  getVenueLocalParts,
  isLocalMidnightEnd,
  venueLocalDateISO,
  venueLocalMonthKey,
} from "@/core/events/timezone";

const BANGKOK = "Asia/Bangkok";

describe("getVenueLocalParts", () => {
  it("returns correct parts for a Bangkok instant", () => {
    // 2026-03-15 20:30:00 UTC = 2026-03-16 03:30:00 Bangkok (+7)
    const instant = new Date("2026-03-15T20:30:00.000Z");
    const parts = getVenueLocalParts(instant, BANGKOK);
    expect(parts.year).toBe(2026);
    expect(parts.month).toBe(3);
    expect(parts.day).toBe(16);
    expect(parts.hour).toBe(3);
    expect(parts.minute).toBe(30);
  });
});

describe("venueLocalDateISO", () => {
  it("returns correct date in Bangkok for midnight crossover", () => {
    // 2026-01-01 17:01:00 UTC = 2026-01-02 00:01:00 Bangkok
    const instant = new Date("2026-01-01T17:01:00.000Z");
    expect(venueLocalDateISO(instant, BANGKOK)).toBe("2026-01-02");
  });

  it("returns previous date in UTC vs Bangkok", () => {
    // 2026-06-15 16:59:00 UTC = 2026-06-15 23:59:00 Bangkok (same day)
    const instant = new Date("2026-06-15T16:59:00.000Z");
    expect(venueLocalDateISO(instant, BANGKOK)).toBe("2026-06-15");
  });

  it("handles overnight event (starts 22:00 Bangkok, ends 01:00 next day)", () => {
    // Start: 2026-04-10 22:00 Bangkok = 2026-04-10 15:00 UTC
    const startInstant = new Date("2026-04-10T15:00:00.000Z");
    // End: 2026-04-11 01:00 Bangkok = 2026-04-10 18:00 UTC
    const endInstant = new Date("2026-04-10T18:00:00.000Z");
    expect(venueLocalDateISO(startInstant, BANGKOK)).toBe("2026-04-10");
    expect(venueLocalDateISO(endInstant, BANGKOK)).toBe("2026-04-11");
  });
});

describe("addDaysToDateOnly", () => {
  it("handles month boundary (Jan 31 -> Feb 1)", () => {
    expect(addDaysToDateOnly("2026-01-31", 1)).toBe("2026-02-01");
  });

  it("handles year boundary (Dec 31 -> Jan 1)", () => {
    expect(addDaysToDateOnly("2025-12-31", 1)).toBe("2026-01-01");
  });

  it("handles leap day (Feb 28 2024 + 1 = Feb 29)", () => {
    expect(addDaysToDateOnly("2024-02-28", 1)).toBe("2024-02-29");
  });

  it("handles subtracting days", () => {
    expect(addDaysToDateOnly("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("returns input unchanged if format invalid", () => {
    expect(addDaysToDateOnly("not-a-date", 1)).toBe("not-a-date");
  });
});

describe("isLocalMidnightEnd", () => {
  it("returns true for exact midnight in Bangkok", () => {
    // 2026-04-01 00:00:00 Bangkok = 2026-03-31 17:00:00 UTC
    const instant = new Date("2026-03-31T17:00:00.000Z");
    expect(isLocalMidnightEnd(instant, BANGKOK)).toBe(true);
  });

  it("returns false for non-midnight", () => {
    const instant = new Date("2026-03-31T18:00:00.000Z"); // 01:00 Bangkok
    expect(isLocalMidnightEnd(instant, BANGKOK)).toBe(false);
  });
});

describe("formatVenueDateTimeRange", () => {
  it("formats same-day event", () => {
    const result = formatVenueDateTimeRange({
      startsAt: "2026-04-10T08:00:00.000Z", // 15:00 Bangkok
      endsAt: "2026-04-10T11:00:00.000Z", // 18:00 Bangkok
      timeZone: BANGKOK,
      locale: "en",
      isAllDay: false,
    });
    expect(result.summary).toContain("15:00");
    expect(result.summary).toContain("18:00");
    expect(result.startTime).toBe("15:00");
    expect(result.endTime).toBe("18:00");
  });

  it("formats overnight event (different start/end date)", () => {
    // Start: 2026-04-10 22:00 Bangkok = 15:00 UTC
    // End: 2026-04-11 01:00 Bangkok = 18:00 UTC
    const result = formatVenueDateTimeRange({
      startsAt: "2026-04-10T15:00:00.000Z",
      endsAt: "2026-04-10T18:00:00.000Z",
      timeZone: BANGKOK,
      locale: "en",
      isAllDay: false,
    });
    // Summary should include both dates since they differ
    expect(result.summary).toContain("→");
  });

  it("formats all-day single-day event", () => {
    const result = formatVenueDateTimeRange({
      startsAt: "2026-04-10T00:00:00.000Z",
      endsAt: "2026-04-10T00:00:00.000Z",
      timeZone: "UTC",
      locale: "en",
      isAllDay: true,
    });
    expect(result.startTime).toBe("");
    expect(result.endTime).toBe("");
  });
});

describe("venueLocalMonthKey", () => {
  it("returns YYYY-MM for Bangkok", () => {
    // 2026-01-01 17:01:00 UTC = 2026-01-02 00:01:00 Bangkok
    const instant = new Date("2026-01-01T17:01:00.000Z");
    expect(venueLocalMonthKey(instant, BANGKOK)).toBe("2026-01");
  });

  it("increments month at midnight crossover", () => {
    // 2026-01-31 17:01:00 UTC = 2026-02-01 00:01:00 Bangkok
    const instant = new Date("2026-01-31T17:01:00.000Z");
    expect(venueLocalMonthKey(instant, BANGKOK)).toBe("2026-02");
  });
});
