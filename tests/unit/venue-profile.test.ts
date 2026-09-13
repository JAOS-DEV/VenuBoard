import { describe, expect, it } from "vitest";

import { ISO_WEEKDAYS } from "@/core/venue-profile/constants";
import {
  listedHoursStatus,
  parseHm,
  rangesOverlap,
  validateWeeklySchedule,
  type HoursException,
  type WeeklyDaySchedule,
} from "@/core/venue-profile/hours";
import {
  formatIntervalLabel,
  isoWeekdayMessageKey,
  listedHoursCopyKey,
} from "@/core/venue-profile/labels";
import {
  openStreetMapHref,
  publicHttpUrl,
  publicMailtoHref,
  publicTelHref,
} from "@/core/venue-profile/links";
import { SaveVenueProfileSchema } from "@/core/venue-profile/schema";

function closedWeek(): WeeklyDaySchedule[] {
  return ISO_WEEKDAYS.map((day) => ({
    day,
    closed: true,
    intervals: [],
  }));
}

function openDay(
  day: WeeklyDaySchedule["day"],
  opens: string,
  closes: string,
  closesNextDay = false,
): WeeklyDaySchedule {
  return {
    day,
    closed: false,
    intervals: [{ opens, closes, closesNextDay }],
  };
}

function scheduled(days: WeeklyDaySchedule[]): WeeklyDaySchedule[] {
  const byDay = new Map(days.map((row) => [row.day, row]));
  return ISO_WEEKDAYS.map(
    (day) => byDay.get(day) ?? { day, closed: true, intervals: [] },
  );
}

function bangkok(isoLocal: string): Date {
  return new Date(`${isoLocal}+07:00`);
}

describe("contact and URL validation", () => {
  it("accepts bounded public email, telephone and http(s) websites", () => {
    expect(publicMailtoHref("harbor.public@example.com")).toBe(
      "mailto:harbor.public@example.com",
    );
    expect(publicTelHref("+66 81 000 0101")).toBe("tel:+66810000101");
    expect(publicHttpUrl("https://harbor-light.example.com")).toBe(
      "https://harbor-light.example.com/",
    );
  });

  it("rejects credentials, dangerous schemes and control characters", () => {
    expect(publicHttpUrl("javascript:alert(1)")).toBeNull();
    expect(publicHttpUrl("https://user:pass@example.com")).toBeNull();
    expect(publicHttpUrl("https://example.com/path\u0000")).toBeNull();
    expect(publicMailtoHref("not-an-email")).toBeNull();
    expect(publicTelHref("call-me")).toBeNull();
    expect(publicTelHref("tel:+66810000101")).toBeNull();
  });

  it("builds OpenStreetMap destination links only from validated location data", () => {
    expect(
      openStreetMapHref({
        latitude: 13.125,
        longitude: 100.875,
        address: "ignored when coordinates exist",
      }),
    ).toBe(
      "https://www.openstreetmap.org/directions?to=13.125000%2C100.875000",
    );
    expect(
      openStreetMapHref({
        latitude: null,
        longitude: null,
        address: "1 Example Pier, Chonburi",
      }),
    ).toBe(
      "https://www.openstreetmap.org/search?query=1%20Example%20Pier%2C%20Chonburi",
    );
    expect(
      openStreetMapHref({
        latitude: null,
        longitude: null,
        address: null,
      }),
    ).toBeNull();
  });

  it("rejects paired latitude/longitude mismatches and unsafe websites", () => {
    const base = {
      venueId: "00000000-0000-4000-8000-000000000101",
      expectedUpdatedAt: "2026-09-07T00:00:00.000Z",
      name: "Harbor Light",
      latitude: null as number | null,
      longitude: null as number | null,
    };
    expect(
      SaveVenueProfileSchema.safeParse({
        ...base,
        latitude: 13.125,
        longitude: null,
      }).success,
    ).toBe(false);
    expect(
      SaveVenueProfileSchema.safeParse({
        ...base,
        website: "javascript:alert(1)",
      }).success,
    ).toBe(false);
    expect(
      SaveVenueProfileSchema.safeParse({
        ...base,
        email: "not-an-email",
      }).success,
    ).toBe(false);
  });
});

describe("opening-hours model", () => {
  it("parses start-inclusive local times and rejects inverted intervals", () => {
    expect(parseHm("18:00")).toBe(18 * 60);
    expect(parseHm("24:00")).toBeNull();
    expect(
      validateWeeklySchedule(scheduled([openDay(5, "18:00", "18:00", false)])),
    ).toBe(false);
    expect(
      validateWeeklySchedule(scheduled([openDay(5, "18:00", "02:00", true)])),
    ).toBe(true);
  });

  it("rejects overlapping intervals including overnight spillover", () => {
    const splitOk = scheduled([
      {
        day: 2,
        closed: false,
        intervals: [
          { opens: "11:00", closes: "14:00", closesNextDay: false },
          { opens: "17:00", closes: "22:00", closesNextDay: false },
        ],
      },
    ]);
    expect(validateWeeklySchedule(splitOk)).toBe(true);

    const overlapSameDay = scheduled([
      {
        day: 1,
        closed: false,
        intervals: [
          { opens: "10:00", closes: "14:00", closesNextDay: false },
          { opens: "13:00", closes: "16:00", closesNextDay: false },
        ],
      },
    ]);
    expect(validateWeeklySchedule(overlapSameDay)).toBe(false);

    const overnightSpill = scheduled([
      openDay(5, "18:00", "02:00", true),
      openDay(6, "01:00", "04:00"),
    ]);
    expect(validateWeeklySchedule(overnightSpill)).toBe(false);
    expect(rangesOverlap({ start: 0, end: 10 }, { start: 10, end: 20 })).toBe(
      false,
    );
  });

  it("treats unknown schedules as distinct from explicitly closed weeks", () => {
    expect(
      listedHoursStatus({
        mode: "unknown",
        timeZone: "Asia/Bangkok",
        week: closedWeek(),
        exceptions: [],
        now: bangkok("2026-09-07T12:00:00"),
      }).status,
    ).toBe("unknown");

    expect(
      listedHoursStatus({
        mode: "scheduled",
        timeZone: "Asia/Bangkok",
        week: closedWeek(),
        exceptions: [],
        now: bangkok("2026-09-07T12:00:00"),
      }).status,
    ).toBe("closed_listed");
  });

  it("handles overnight service, midnight rollover and split intervals", () => {
    const week = scheduled([
      openDay(4, "18:00", "02:00", true),
      openDay(5, "18:00", "02:00", true),
    ]);
    expect(
      listedHoursStatus({
        mode: "scheduled",
        timeZone: "Asia/Bangkok",
        week,
        exceptions: [],
        now: bangkok("2026-09-11T01:00:00"),
      }).status,
    ).toBe("open_listed");
    expect(
      listedHoursStatus({
        mode: "scheduled",
        timeZone: "Asia/Bangkok",
        week,
        exceptions: [],
        now: bangkok("2026-09-11T03:00:00"),
      }).status,
    ).toBe("closed_listed");
    expect(
      listedHoursStatus({
        mode: "scheduled",
        timeZone: "Asia/Bangkok",
        week: scheduled([
          {
            day: 2,
            closed: false,
            intervals: [
              { opens: "11:00", closes: "14:00", closesNextDay: false },
              { opens: "17:00", closes: "22:00", closesNextDay: false },
            ],
          },
        ]),
        exceptions: [],
        now: bangkok("2026-09-08T15:00:00"),
      }).status,
    ).toBe("closed_listed");
  });

  it("lets a date exception replace that local day and truncate prior overnight", () => {
    const week = scheduled([openDay(5, "18:00", "02:00", true)]);
    const closedSaturday: HoursException[] = [
      { date: "2026-09-12", closed: true, intervals: [] },
    ];
    expect(
      listedHoursStatus({
        mode: "scheduled",
        timeZone: "Asia/Bangkok",
        week,
        exceptions: closedSaturday,
        now: bangkok("2026-09-12T01:00:00"),
      }).status,
    ).toBe("closed_listed");
    expect(
      listedHoursStatus({
        mode: "scheduled",
        timeZone: "Asia/Bangkok",
        week,
        exceptions: [],
        now: bangkok("2026-09-12T01:00:00"),
      }).status,
    ).toBe("open_listed");
  });

  it("keeps Friday overnight when Saturday is only a weekly closed day", () => {
    const week = scheduled([openDay(5, "18:00", "02:00", true)]);
    expect(
      listedHoursStatus({
        mode: "scheduled",
        timeZone: "Asia/Bangkok",
        week,
        exceptions: [],
        now: bangkok("2026-09-12T01:00:00"),
      }).status,
    ).toBe("open_listed");
  });

  it("calculates the next listed-hours boundary without claiming live availability", () => {
    const listed = listedHoursStatus({
      mode: "scheduled",
      timeZone: "Asia/Bangkok",
      week: scheduled([openDay(1, "10:00", "22:00")]),
      exceptions: [],
      now: bangkok("2026-09-07T21:00:00"),
    });
    expect(listed.status).toBe("open_listed");
    expect(listed.nextTransitionAtMs).toBe(
      bangkok("2026-09-07T22:00:00").getTime(),
    );
    expect(listedHoursCopyKey(listed.status)).toBe("hoursOpenListed");
  });

  it("uses Intl local wall-clock in a DST timezone", () => {
    const week = scheduled([openDay(7, "00:00", "04:00")]);
    const before = listedHoursStatus({
      mode: "scheduled",
      timeZone: "Europe/London",
      week,
      exceptions: [],
      now: new Date("2026-03-29T00:30:00Z"),
    });
    const after = listedHoursStatus({
      mode: "scheduled",
      timeZone: "Europe/London",
      week,
      exceptions: [],
      now: new Date("2026-03-29T01:30:00Z"),
    });
    expect(before.status).toBe("open_listed");
    expect(after.status).toBe("open_listed");
  });
});

describe("human labels", () => {
  it("uses ISO weekdays Monday=1 and overnight copy", () => {
    expect(isoWeekdayMessageKey(1)).toBe("monday");
    expect(isoWeekdayMessageKey(7)).toBe("sunday");
    expect(formatIntervalLabel("18:00", "02:00", true, "next day")).toBe(
      "18:00–02:00 (next day)",
    );
  });
});
