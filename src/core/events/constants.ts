export const EVENTS_MODULE_KEY = "events" as const;

export const SUPPORTED_EVENT_LOCALES = ["en", "th"] as const;

export type EventLocale = (typeof SUPPORTED_EVENT_LOCALES)[number];

export type PublicVenueEventsView = "upcoming" | "month" | "archive";
