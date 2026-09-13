export const ISO_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

export type IsoWeekday = (typeof ISO_WEEKDAYS)[number];

export const VENUE_HOURS_MAX_INTERVALS = 4;
export const VENUE_NAME_MAX = 80;
export const VENUE_TAGLINE_MAX = 160;
export const VENUE_DESCRIPTION_MAX = 4000;
export const VENUE_DIRECTIONS_MAX = 1000;
export const OSM_DIRECTIONS_BASE = "https://www.openstreetmap.org/directions";
export const OSM_SEARCH_BASE = "https://www.openstreetmap.org/search";

export const VENUE_PROFILE_ERROR_CODES = [
  "unauthenticated",
  "forbidden",
  "invalid_payload",
  "not_found",
  "conflict",
  "not_ready",
  "unavailable",
] as const;

export type VenueProfileErrorCode = (typeof VENUE_PROFILE_ERROR_CODES)[number];
