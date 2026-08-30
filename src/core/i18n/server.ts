import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { routing, type AppLocale } from "./routing";

/**
 * Validates the `[locale]` segment and registers it for the rest of the
 * request, so static rendering works and `useTranslations` resolves.
 *
 * The segment behaves like a catch-all, so an unknown value must 404 rather
 * than render an English page under a nonsense prefix.
 */
export async function resolveRequestLocale(
  params: Promise<{ locale: string }>,
): Promise<AppLocale> {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  return locale;
}
