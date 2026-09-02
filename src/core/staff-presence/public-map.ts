import {
  DEFAULT_STAFF_MODULE_SETTINGS,
  type StaffCarouselOrder,
  type StaffDisplayMode,
} from "./constants";
import { publicDisplayInitials } from "./initials";
import { clampPresenceExpiryHours } from "./expiry";

export interface PublicStaffCarouselItem {
  publicId: string;
  displayName: string;
  title: string | null;
  bio: string | null;
  initials: string;
  presenceState: "present" | "not_present";
}

export interface PublicStaffCarousel {
  available: boolean;
  heading: string | null;
  displayMode: StaffDisplayMode;
  carouselOrder: StaffCarouselOrder;
  autoAdvance: boolean;
  locale: "en" | "th";
  venue: {
    name: string;
    slug: string;
    contentClassification: string;
  } | null;
  items: PublicStaffCarouselItem[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function mapPublicStaffCarousel(
  payload: unknown,
  locale: "en" | "th",
): PublicStaffCarousel {
  const record = asRecord(payload);
  if (record === null || record.ok !== true || record.available !== true) {
    const venue = asRecord(record?.venue);
    return {
      available: false,
      heading: null,
      displayMode: DEFAULT_STAFF_MODULE_SETTINGS.displayMode,
      carouselOrder: DEFAULT_STAFF_MODULE_SETTINGS.carouselOrder,
      autoAdvance: false,
      locale,
      venue:
        venue === null
          ? null
          : {
              name: asString(venue.name) ?? "",
              slug: asString(venue.slug) ?? "",
              contentClassification:
                asString(venue.content_classification) ?? "general",
            },
      items: [],
    };
  }

  const itemsRaw = Array.isArray(record.items) ? record.items : [];
  const venue = asRecord(record.venue);

  return {
    available: true,
    heading: asString(record.heading),
    displayMode:
      record.display_mode === "present_only" ? "present_only" : "all_published",
    carouselOrder: record.carousel_order === "name" ? "name" : "display_order",
    autoAdvance: record.auto_advance === true,
    locale: asString(record.locale) === "th" ? "th" : "en",
    venue:
      venue === null
        ? null
        : {
            name: asString(venue.name) ?? "",
            slug: asString(venue.slug) ?? "",
            contentClassification:
              asString(venue.content_classification) ?? "general",
          },
    items: itemsRaw.flatMap((entry) => {
      const item = asRecord(entry);
      if (item === null) {
        return [];
      }
      const displayName = asString(item.display_name);
      const publicId = asString(item.public_id);
      if (displayName === null || publicId === null) {
        return [];
      }
      return [
        {
          publicId,
          displayName,
          title: asString(item.title),
          bio: asString(item.bio),
          initials: publicDisplayInitials(displayName),
          presenceState:
            item.presence_state === "present" ? "present" : "not_present",
        },
      ];
    }),
  };
}

export function parseStaffModuleSettings(value: unknown): {
  displayMode: StaffDisplayMode;
  carouselOrder: StaffCarouselOrder;
  presenceExpiryHours: number;
  carouselAutoAdvance: boolean;
} {
  const record = asRecord(value);
  if (record === null) {
    return DEFAULT_STAFF_MODULE_SETTINGS;
  }

  return {
    displayMode:
      record.display_mode === "present_only" ? "present_only" : "all_published",
    carouselOrder: record.carousel_order === "name" ? "name" : "display_order",
    presenceExpiryHours: clampPresenceExpiryHours(
      typeof record.presence_expiry_hours === "number"
        ? record.presence_expiry_hours
        : DEFAULT_STAFF_MODULE_SETTINGS.presenceExpiryHours,
    ),
    carouselAutoAdvance: record.carousel_auto_advance === true,
  };
}
