export const BOOKING_MODULE_KEY = "booking_requests" as const;

export const BOOKING_STATES = ["new", "in_review", "closed"] as const;

export type BookingEnquiryState = (typeof BOOKING_STATES)[number];

export const BOOKING_OUTCOMES = [
  "handled",
  "declined",
  "duplicate",
  "spam",
  "withdrawn",
] as const;

export type BookingClosureOutcome = (typeof BOOKING_OUTCOMES)[number];

export const BOOKING_PAGE_DEFAULT = 12;
export const BOOKING_PAGE_MAX = 24;

export const BOOKING_NAME_MAX = 80;
export const BOOKING_EMAIL_MAX = 254;
export const BOOKING_MESSAGE_MAX = 500;
export const BOOKING_HEADING_MAX = 80;
export const BOOKING_INSTRUCTIONS_MAX = 500;
