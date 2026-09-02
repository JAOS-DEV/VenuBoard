import type { AppLocale } from "@/core/i18n/routing";

export function normalizeStaffTranslation(
  requested: AppLocale,
  translations: Partial<Record<AppLocale, string | null | undefined>>,
  fallbackLocale: AppLocale = "en",
): string | null {
  const requestedValue = translations[requested]?.trim();
  if (requestedValue !== undefined && requestedValue.length > 0) {
    return requestedValue;
  }

  const fallbackValue = translations[fallbackLocale]?.trim();
  if (fallbackValue !== undefined && fallbackValue.length > 0) {
    return fallbackValue;
  }

  if (fallbackLocale !== "en") {
    const english = translations.en?.trim();
    if (english !== undefined && english.length > 0) {
      return english;
    }
  }

  const thai = translations.th?.trim();
  if (thai !== undefined && thai.length > 0) {
    return thai;
  }

  return null;
}
