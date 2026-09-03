import type { PublicEventItem, PublicVenueEventsPayload } from "./public-types";
import type { EventLocale } from "./constants";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function asLocale(value: unknown): EventLocale {
  return value === "th" ? "th" : "en";
}

export function mapPublicVenueEvents(
  payload: unknown,
  fallbackLocale: EventLocale,
): PublicVenueEventsPayload {
  const record = asRecord(payload);
  if (record === null || record.ok !== true || record.available !== true) {
    return {
      available: false,
      ok: true,
      heading: null,
      locale: fallbackLocale,
      timezone: null,
      defaultDisplay: "calendar_and_list",
      showPastArchive: false,
      items: [],
    };
  }

  const itemsRaw = Array.isArray(record.items) ? record.items : [];
  const defaultDisplayRaw = asString(record.default_display);
  const defaultDisplay =
    defaultDisplayRaw === "upcoming_list"
      ? "upcoming_list"
      : "calendar_and_list";

  const locale = asLocale(record.locale);
  const timezone = asString(record.timezone);

  const items: PublicEventItem[] = itemsRaw.flatMap((entry) => {
    const item = asRecord(entry);
    if (item === null) return [];

    const id = asString(item.id);
    const startsAt = asString(item.starts_at);
    const endsAt = asString(item.ends_at);
    const itemTimezone = asString(item.timezone);
    const isAllDay = asBoolean(item.is_all_day);
    const title = asString(item.title);

    if (
      id === null ||
      startsAt === null ||
      endsAt === null ||
      itemTimezone === null ||
      isAllDay === null ||
      title === null
    ) {
      return [];
    }

    return [
      {
        id,
        startsAt,
        endsAt,
        timezone: itemTimezone,
        isAllDay,
        title,
        summary: asString(item.summary),
        description: asString(item.description),
        ctaLabel: asString(item.cta_label),
        locale,
      },
    ];
  });

  return {
    available: true,
    ok: true,
    heading: asString(record.heading),
    locale,
    timezone,
    defaultDisplay,
    showPastArchive: asBoolean(record.show_past_archive) ?? false,
    items,
  };
}
