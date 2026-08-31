"use client";

import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Suspense } from "react";

import { parseSafeApplicationPath } from "@/core/auth/redirects";
import { Link, usePathname } from "@/core/i18n/navigation";
import { routing } from "@/core/i18n/routing";
import { cn } from "@/lib/utils";

const LOCALE_LABELS: Record<string, string> = {
  en: "English",
  th: "ไทย",
};

function LocaleSwitcherLinks(): React.ReactElement {
  const activeLocale = useLocale();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("shell");
  const next = parseSafeApplicationPath(searchParams.get("next"));

  return (
    <nav aria-label={t("language")} className="flex items-center gap-1">
      {routing.locales.map((locale) => {
        const isActive = locale === activeLocale;
        const href = next === null ? pathname : { pathname, query: { next } };

        return (
          <Link
            key={locale}
            href={href}
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

/**
 * Locale switcher. Preserves the current path and a validated `next` query
 * parameter. Unsafe return paths are dropped rather than copied.
 */
export function LocaleSwitcher(): React.ReactElement {
  return (
    <Suspense>
      <LocaleSwitcherLinks />
    </Suspense>
  );
}
