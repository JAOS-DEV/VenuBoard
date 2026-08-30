import { defineRouting } from "next-intl/routing";

/**
 * Interface locales. English is the default; Thai is a first-class locale, not
 * an afterthought (docs/architecture.md section 11).
 *
 * This governs **interface strings only**. Venue-authored content will live in
 * normalised, entity-specific translation tables (ADR-028) and is not modelled
 * yet.
 */
export const routing = defineRouting({
  locales: ["en", "th"],
  defaultLocale: "en",
  localePrefix: "always",
});

export type AppLocale = (typeof routing.locales)[number];
