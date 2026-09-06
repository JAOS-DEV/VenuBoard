import { getVenueLocalParts } from "@/core/events/timezone";

export interface VenueLocalDateTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

export function parseVenueLocalDateTime(
  value: string,
): VenueLocalDateTime | null {
  const match = /^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2})$/.exec(
    value,
  );
  if (match === null) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour > 23 ||
    minute > 59
  ) {
    return null;
  }
  return { year, month, day, hour, minute };
}

export function venueLocalDateTimeToUtc(
  local: VenueLocalDateTime,
  timeZone: string,
): Date | null {
  const utcGuess = Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hour,
    local.minute,
  );
  let instant = new Date(utcGuess);
  for (let i = 0; i < 3; i += 1) {
    const parts = getVenueLocalParts(instant, timeZone);
    const deltaMinutes =
      (local.year - parts.year) * 525600 +
      (local.month - parts.month) * 43200 +
      (local.day - parts.day) * 1440 +
      (local.hour - parts.hour) * 60 +
      (local.minute - parts.minute);
    if (deltaMinutes === 0) {
      const roundTrip = getVenueLocalParts(instant, timeZone);
      if (
        roundTrip.year === local.year &&
        roundTrip.month === local.month &&
        roundTrip.day === local.day &&
        roundTrip.hour === local.hour &&
        roundTrip.minute === local.minute
      ) {
        return instant;
      }
      return null;
    }
    instant = new Date(instant.getTime() + deltaMinutes * 60_000);
  }
  return null;
}

export function venueInstantToLocalInput(
  instant: Date,
  timeZone: string,
): string {
  const parts = getVenueLocalParts(instant, timeZone);
  const mm = String(parts.month).padStart(2, "0");
  const dd = String(parts.day).padStart(2, "0");
  const hh = String(Math.min(parts.hour, 23)).padStart(2, "0");
  const min = String(parts.minute).padStart(2, "0");
  return `${String(parts.year)}-${mm}-${dd}T${hh}:${min}`;
}
