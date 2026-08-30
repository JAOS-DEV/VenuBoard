"use client";

import { useLocale, useTranslations } from "next-intl";

import { Link, usePathname } from "@/core/i18n/navigation";
import { routing } from "@/core/i18n/routing";
import { cn } from "@/lib/utils";

const LOCALE_LABELS: Record<string, string> = {
  en: "English",
  th: "ไทย",
};

/**
 * Minimal locale switcher. Deliberately plain links rather than a dropdown:
 * two locales do not need a menu, and links work without JavaScript.
 */
export function LocaleSwitcher(): React.ReactElement {
  const activeLocale = useLocale();
  const pathname = usePathname();
  const t = useTranslations("shell");

  return (
    <nav aria-label={t("language")} className="flex items-center gap-1">
      {routing.locales.map((locale) => {
        const isActive = locale === activeLocale;

        return (
          <Link
            key={locale}
            href={pathname}
            locale={locale}
            aria-current={isActive ? "true" : undefined}
            lang={locale}
            className={cn(
              "inline-flex h-11 items-center rounded-md px-3 text-sm transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isActive
                ? "bg-secondary font-medium text-secondary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            {LOCALE_LABELS[locale] ?? locale}
          </Link>
        );
      })}
    </nav>
  );
}
