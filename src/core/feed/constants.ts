export const FEED_MODULE_KEY = "feed" as const;

export const SUPPORTED_FEED_LOCALES = ["en", "th"] as const;

export type FeedLocale = (typeof SUPPORTED_FEED_LOCALES)[number];

export const FEED_POST_TYPES = ["update", "announcement", "notice"] as const;

export type FeedPostType = (typeof FEED_POST_TYPES)[number];

export const FEED_STATES = [
  "draft",
  "pending_approval",
  "scheduled",
  "published",
  "archived",
] as const;

export type FeedPostState = (typeof FEED_STATES)[number];

export const FEED_PAGE_DEFAULT = 12;
export const FEED_PAGE_MAX = 24;
export const FEED_PIN_LIMIT = 3;
