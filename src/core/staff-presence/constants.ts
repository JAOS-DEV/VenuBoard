export const STAFF_MODULE_KEY = "staff_presence" as const;

export const STAFF_PRESENCE_STATES = ["present", "not_present"] as const;
export type StaffPresenceState = (typeof STAFF_PRESENCE_STATES)[number];

export const STAFF_CONSENT_STATES = [
  "pending",
  "granted",
  "withdrawn",
] as const;
export type StaffConsentState = (typeof STAFF_CONSENT_STATES)[number];

export const STAFF_PUBLICATION_STATES = ["draft", "published"] as const;
export type StaffPublicationState = (typeof STAFF_PUBLICATION_STATES)[number];

export const STAFF_ASSIGNMENT_STATES = ["active", "inactive"] as const;
export type StaffAssignmentStatus = (typeof STAFF_ASSIGNMENT_STATES)[number];

export const STAFF_MEMBER_STATUSES = ["active", "deactivated"] as const;
export type StaffMemberStatus = (typeof STAFF_MEMBER_STATUSES)[number];

export const STAFF_DISPLAY_MODES = ["present_only", "all_published"] as const;
export type StaffDisplayMode = (typeof STAFF_DISPLAY_MODES)[number];

export const STAFF_CAROUSEL_ORDERS = ["display_order", "name"] as const;
export type StaffCarouselOrder = (typeof STAFF_CAROUSEL_ORDERS)[number];

export const MIN_PRESENCE_EXPIRY_HOURS = 1;
export const MAX_PRESENCE_EXPIRY_HOURS = 24;
export const DEFAULT_PRESENCE_EXPIRY_HOURS = 12;

export const PUBLIC_STAFF_PAGE_LIMIT = 24;

export const DEFAULT_STAFF_MODULE_SETTINGS = {
  displayMode: "all_published" as StaffDisplayMode,
  carouselOrder: "display_order" as StaffCarouselOrder,
  presenceExpiryHours: DEFAULT_PRESENCE_EXPIRY_HOURS,
  carouselAutoAdvance: false,
};

export const STAFF_ERROR_CODES = [
  "unauthenticated",
  "forbidden",
  "invalid_payload",
  "not_found",
  "conflict",
  "inactive",
  "unavailable",
] as const;

export type StaffErrorCode = (typeof STAFF_ERROR_CODES)[number];
