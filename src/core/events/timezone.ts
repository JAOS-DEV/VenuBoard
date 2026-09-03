export interface VenueLocalParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number; // 0-23
  minute: number; // 0-59
  second: number; // 0-59
}

function formatToParts(
  date: Date,
  timeZone: string,
): Intl.DateTimeFormatPart[] {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
}

function getPart(
  parts: Intl.DateTimeFormatPart[],
  type: string,
): string | null {
  const part = parts.find((p) => p.type === type);
  return part?.value ?? null;
}

export function getVenueLocalParts(
  instant: Date,
  timeZone: string,
): VenueLocalParts {
  const parts = formatToParts(instant, timeZone);
  const year = Number(getPart(parts, "year"));
  const month = Number(getPart(parts, "month"));
  const day = Number(getPart(parts, "day"));
  const hour = Number(getPart(parts, "hour"));
  const minute = Number(getPart(parts, "minute"));
  const second = Number(getPart(parts, "second"));

  return { year, month, day, hour, minute, second };
}

export function venueLocalDateISO(instant: Date, timeZone: string): string {
  const { year, month, day } = getVenueLocalParts(instant, timeZone);
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

export function venueLocalTimeISO(instant: Date, timeZone: string): string {
  const { hour, minute, second } = getVenueLocalParts(instant, timeZone);
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  const ss = String(second).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export function isLocalMidnightEnd(instant: Date, timeZone: string): boolean {
  const { hour, minute, second } = getVenueLocalParts(instant, timeZone);
  return hour === 0 && minute === 0 && second === 0;
}

export function addDaysToDateOnly(dateISO: string, deltaDays: number): string {
  const parts = dateISO.split("-");
  if (parts.length !== 3) {
    return dateISO;
  }
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return dateISO;
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + deltaDays);
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function venueLocalMonthKey(instant: Date, timeZone: string): string {
  const { year, month } = getVenueLocalParts(instant, timeZone);
  const mm = String(month).padStart(2, "0");
  return `${year}-${mm}`;
}

export function formatVenueDateTimeRange(params: {
  startsAt: string; // ISO
  endsAt: string; // ISO
  timeZone: string;
  locale: "en" | "th";
  isAllDay: boolean;
}): { summary: string; startTime: string; endTime: string } {
  const startInstant = new Date(params.startsAt);
  const endInstant = new Date(params.endsAt);

  if (params.isAllDay) {
    const startISO = venueLocalDateISO(startInstant, params.timeZone);
    const endISO = venueLocalDateISO(endInstant, params.timeZone);
    return {
      summary: startISO === endISO ? startISO : `${startISO} → ${endISO}`,
      startTime: "",
      endTime: "",
    };
  }

  const locale = params.locale === "th" ? "th-TH" : "en-US";

  const dateFmt = new Intl.DateTimeFormat(locale, {
    timeZone: params.timeZone,
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const timeFmt = new Intl.DateTimeFormat(locale, {
    timeZone: params.timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const startDate = dateFmt.format(startInstant);
  const endDate = dateFmt.format(endInstant);
  const startTime = timeFmt.format(startInstant);
  const endTime = timeFmt.format(endInstant);

  if (startDate === endDate) {
    return {
      summary: `${startDate} • ${startTime}–${endTime}`,
      startTime,
      endTime,
    };
  }

  return {
    summary: `${startDate} ${startTime} → ${endDate} ${endTime}`,
    startTime,
    endTime,
  };
}
