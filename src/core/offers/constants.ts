export const OFFERS_MODULE_KEY = "offers" as const;

export const SUPPORTED_OFFER_LOCALES = ["en", "th"] as const;

export type OfferLocale = (typeof SUPPORTED_OFFER_LOCALES)[number];

export const OFFER_STATES = [
  "draft",
  "pending_approval",
  "scheduled",
  "published",
  "archived",
] as const;

export type OfferState = (typeof OFFER_STATES)[number];

export const OFFER_PAGE_DEFAULT = 12;
export const OFFER_PAGE_MAX = 24;

export const OFFER_TITLE_MAX = 120;
export const OFFER_DESCRIPTION_MAX = 2000;
export const OFFER_TERMS_MAX = 4000;
export const OFFER_HEADING_MAX = 80;
export const OFFER_PREVIEW_COUNT_MIN = 1;
export const OFFER_PREVIEW_COUNT_MAX = 6;
