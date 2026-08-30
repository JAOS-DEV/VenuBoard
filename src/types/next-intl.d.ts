import type messages from "../../messages/en.json";
import type { routing } from "@/core/i18n/routing";

/**
 * Type-safe message keys and locales. English is the reference catalogue, so a
 * key that exists in Thai but not English is a type error rather than a
 * runtime surprise.
 */
declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
  }
}
