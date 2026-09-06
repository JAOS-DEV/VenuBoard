import type { OfferLocale } from "./constants";
import type { PublicOfferItem, PublicVenueOffersPayload } from "./public-types";

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

function asLocale(value: unknown): OfferLocale {
  return value === "th" ? "th" : "en";
}

function mapItem(
  value: unknown,
  fallbackLocale: OfferLocale,
): PublicOfferItem | null {
  const record = asRecord(value);
  if (record === null) {
    return null;
  }
  const title = asString(record.title);
  const description = asString(record.description);
  const terms = asString(record.terms);
  const validFrom = asString(record.valid_from);
  const validUntil = asString(record.valid_until);
  if (
    title === null ||
    description === null ||
    terms === null ||
    validFrom === null ||
    validUntil === null
  ) {
    return null;
  }
  return {
    title,
    description,
    terms,
    validFrom,
    validUntil,
    locale: asLocale(record.locale ?? fallbackLocale),
  };
}

export function mapPublicVenueOffers(
  payload: unknown,
  fallbackLocale: OfferLocale,
): PublicVenueOffersPayload {
  const hidden: PublicVenueOffersPayload = {
    available: false,
    ok: true,
    heading: null,
    previewEnabled: false,
    previewCount: 3,
    timezone: "UTC",
    items: [],
    nextCursor: null,
    locale: fallbackLocale,
  };

  const record = asRecord(payload);
  if (record === null || record.ok !== true || record.available !== true) {
    return hidden;
  }

  const rawItems = record.items;
  const items: PublicOfferItem[] = [];
  if (Array.isArray(rawItems)) {
    for (const entry of rawItems) {
      const item = mapItem(entry, fallbackLocale);
      if (item !== null) {
        items.push(item);
      }
    }
  }

  const previewCount =
    typeof record.preview_count === "number" &&
    Number.isInteger(record.preview_count)
      ? Math.min(6, Math.max(1, record.preview_count))
      : 3;

  return {
    available: true,
    ok: true,
    heading: asString(record.heading),
    previewEnabled: asBoolean(record.preview_enabled) === true,
    previewCount,
    timezone: asString(record.timezone) ?? "UTC",
    items,
    nextCursor: asString(record.next_cursor),
    locale: fallbackLocale,
  };
}

export function isOfferReleased(input: {
  state: string;
  scheduledFor: string | null;
  publishedAt: string | null;
  archivedAt: string | null;
  quarantinedAt: string | null;
  nowMs?: number;
}): boolean {
  if (input.archivedAt !== null || input.quarantinedAt !== null) {
    return false;
  }
  const now = input.nowMs ?? Date.now();
  if (input.state === "published") {
    if (input.publishedAt === null) {
      return false;
    }
    return Date.parse(input.publishedAt) <= now;
  }
  if (input.state === "scheduled" && input.scheduledFor !== null) {
    return Date.parse(input.scheduledFor) <= now;
  }
  return false;
}

export function isOfferWithinValidity(input: {
  validFrom: string;
  validUntil: string;
  nowMs?: number;
}): boolean {
  const now = input.nowMs ?? Date.now();
  const from = Date.parse(input.validFrom);
  const until = Date.parse(input.validUntil);
  if (Number.isNaN(from) || Number.isNaN(until) || until <= from) {
    return false;
  }
  return from <= now && now < until;
}

export function isOfferPubliclyEligible(input: {
  state: string;
  scheduledFor: string | null;
  publishedAt: string | null;
  archivedAt: string | null;
  quarantinedAt: string | null;
  validFrom: string;
  validUntil: string;
  nowMs?: number;
}): boolean {
  return (
    isOfferReleased(input) &&
    isOfferWithinValidity({
      validFrom: input.validFrom,
      validUntil: input.validUntil,
      nowMs: input.nowMs,
    })
  );
}

export function publicOfferCopy(
  requestedLocale: OfferLocale,
  translations: {
    en: { title: string; description: string; terms: string };
    th?: { title: string; description: string; terms: string } | null;
  },
): { title: string; description: string; terms: string; locale: OfferLocale } {
  if (requestedLocale === "th" && translations.th) {
    return { ...translations.th, locale: "th" };
  }
  return { ...translations.en, locale: "en" };
}
