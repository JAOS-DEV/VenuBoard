import type { IsoWeekday } from "./constants";
import { ISO_WEEKDAYS, VENUE_HOURS_MAX_INTERVALS } from "./constants";

export interface HoursInterval {
  opens: string;
  closes: string;
  closesNextDay: boolean;
}

export interface WeeklyDaySchedule {
  day: IsoWeekday;
  closed: boolean;
  intervals: HoursInterval[];
}

export interface HoursException {
  date: string;
  closed: boolean;
  intervals: HoursInterval[];
}

export type ListedHoursStatus = "unknown" | "open_listed" | "closed_listed";

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseHm(value: string): number | null {
  const match = TIME_RE.exec(value);
  if (match === null) {
    return null;
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

export function intervalRange(
  day: IsoWeekday,
  interval: HoursInterval,
): { start: number; end: number } | null {
  const opens = parseHm(interval.opens);
  const closes = parseHm(interval.closes);
  if (opens === null || closes === null) {
    return null;
  }
  const start = (day - 1) * 1440 + opens;
  let end = (day - 1) * 1440 + closes;
  if (interval.closesNextDay) {
    end += 1440;
  }
  if (end <= start) {
    return null;
  }
  return { start, end };
}

export function rangesOverlap(
  a: { start: number; end: number },
  b: { start: number; end: number },
): boolean {
  const shifted = (range: { start: number; end: number }) => ({
    start: range.start + 10080,
    end: range.end + 10080,
  });
  const hits = (
    left: { start: number; end: number },
    right: { start: number; end: number },
  ): boolean => left.start < right.end && right.start < left.end;
  return hits(a, b) || hits(a, shifted(b)) || hits(shifted(a), b);
}

export function validateWeeklySchedule(week: WeeklyDaySchedule[]): boolean {
  if (week.length !== 7) {
    return false;
  }
  const seen = new Set<IsoWeekday>();
  const ranges: { start: number; end: number }[] = [];
  for (const day of week) {
    if (!ISO_WEEKDAYS.includes(day.day) || seen.has(day.day)) {
      return false;
    }
    seen.add(day.day);
    if (day.closed) {
      if (day.intervals.length > 0) {
        return false;
      }
      continue;
    }
    if (
      day.intervals.length < 1 ||
      day.intervals.length > VENUE_HOURS_MAX_INTERVALS
    ) {
      return false;
    }
    for (const interval of day.intervals) {
      const range = intervalRange(day.day, interval);
      if (range === null) {
        return false;
      }
      ranges.push(range);
    }
  }
  for (let i = 0; i < ranges.length; i += 1) {
    for (let j = i + 1; j < ranges.length; j += 1) {
      const left = ranges[i];
      const right = ranges[j];
      if (
        left !== undefined &&
        right !== undefined &&
        rangesOverlap(left, right)
      ) {
        return false;
      }
    }
  }
  return seen.size === 7;
}

function localParts(
  timeZone: string,
  at: Date,
): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  isoDay: IsoWeekday;
  date: string;
} {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = fmt.formatToParts(at);
  const get = (type: string): number =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");
  const year = get("year");
  const month = get("month");
  const day = get("day");
  const utc = Date.UTC(year, month - 1, day);
  const sunday0 = new Date(utc).getUTCDay();
  const isoDay = (sunday0 === 0 ? 7 : sunday0) as IsoWeekday;
  return {
    year,
    month,
    day,
    hour: get("hour"),
    minute: get("minute"),
    isoDay,
    date: `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  };
}

function previousIsoDay(day: IsoWeekday): IsoWeekday {
  return (day === 1 ? 7 : day - 1) as IsoWeekday;
}

function intervalsForDate(
  week: WeeklyDaySchedule[],
  exceptions: HoursException[],
  date: string,
  isoDay: IsoWeekday,
): { intervals: HoursInterval[]; closed: boolean; exception: boolean } {
  const exception = exceptions.find((row) => row.date === date);
  if (exception !== undefined) {
    return {
      intervals: exception.closed ? [] : exception.intervals,
      closed: exception.closed,
      exception: true,
    };
  }
  const weekly = week.find((row) => row.day === isoDay);
  if (weekly === undefined) {
    return { intervals: [], closed: false, exception: false };
  }
  return {
    intervals: weekly.closed ? [] : weekly.intervals,
    closed: weekly.closed,
    exception: false,
  };
}

export function listedHoursStatus(input: {
  mode: "unknown" | "scheduled";
  timeZone: string;
  week: WeeklyDaySchedule[];
  exceptions: HoursException[];
  now?: Date;
}): {
  status: ListedHoursStatus;
  nextTransitionAtMs: number | null;
} {
  if (input.mode === "unknown") {
    return { status: "unknown", nextTransitionAtMs: null };
  }
  const now = input.now ?? new Date();
  const today = localParts(input.timeZone, now);
  const todayPlan = intervalsForDate(
    input.week,
    input.exceptions,
    today.date,
    today.isoDay,
  );
  const nowMin = today.hour * 60 + today.minute;
  const weekNow = (today.isoDay - 1) * 1440 + nowMin;

  const active: { start: number; end: number }[] = [];
  for (const interval of todayPlan.intervals) {
    const range = intervalRange(today.isoDay, interval);
    if (range !== null) {
      active.push(range);
    }
  }

  if (!todayPlan.exception) {
    const prevDay = previousIsoDay(today.isoDay);
    const yesterdayDate = shiftLocalDate(today.date, -1);
    const yesterday = intervalsForDate(
      input.week,
      input.exceptions,
      yesterdayDate,
      prevDay,
    );
    for (const interval of yesterday.intervals) {
      if (!interval.closesNextDay) {
        continue;
      }
      const range = intervalRange(prevDay, interval);
      if (range !== null) {
        active.push(range);
      }
    }
  }

  const open = active.some(
    (range) =>
      (range.start <= weekNow && weekNow < range.end) ||
      (range.start <= weekNow + 10080 && weekNow + 10080 < range.end),
  );

  const boundaries: number[] = [];
  for (const range of active) {
    boundaries.push(range.start, range.end);
  }
  const next = nextBoundaryMs(now, today, weekNow, boundaries);

  return {
    status: open ? "open_listed" : "closed_listed",
    nextTransitionAtMs: next,
  };
}

function shiftLocalDate(date: string, days: number): string {
  if (!DATE_RE.test(date)) {
    return date;
  }
  const [year, month, day] = date.split("-").map(Number);
  const shifted = new Date(
    Date.UTC(year ?? 0, (month ?? 1) - 1, (day ?? 1) + days),
  );
  return `${String(shifted.getUTCFullYear()).padStart(4, "0")}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`;
}

function nextBoundaryMs(
  now: Date,
  today: ReturnType<typeof localParts>,
  weekNow: number,
  boundaries: number[],
): number | null {
  let soonest: number | null = null;
  for (const boundary of boundaries) {
    let delta = boundary - weekNow;
    if (delta <= 0) {
      delta += 10080;
    }
    if (soonest === null || delta < soonest) {
      soonest = delta;
    }
  }
  const midnight = 1440 - (today.hour * 60 + today.minute);
  if (soonest === null || midnight < soonest) {
    soonest = midnight === 0 ? 1440 : midnight;
  }
  if (soonest === null) {
    return null;
  }
  return now.getTime() + soonest * 60_000;
}
