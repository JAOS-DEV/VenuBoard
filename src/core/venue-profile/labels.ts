import type { IsoWeekday } from "./constants";

export const ISO_WEEKDAY_MESSAGE_KEYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export function isoWeekdayMessageKey(
  day: IsoWeekday,
): (typeof ISO_WEEKDAY_MESSAGE_KEYS)[number] {
  return ISO_WEEKDAY_MESSAGE_KEYS[day - 1] ?? "monday";
}

export function formatIntervalLabel(
  opens: string,
  closes: string,
  closesNextDay: boolean,
  nextDayLabel: string,
): string {
  if (closesNextDay) {
    return `${opens}–${closes} (${nextDayLabel})`;
  }
  return `${opens}–${closes}`;
}

export function listedHoursCopyKey(
  status: "unknown" | "open_listed" | "closed_listed",
): "hoursUnknown" | "hoursOpenListed" | "hoursClosedListed" {
  if (status === "open_listed") {
    return "hoursOpenListed";
  }
  if (status === "closed_listed") {
    return "hoursClosedListed";
  }
  return "hoursUnknown";
}
