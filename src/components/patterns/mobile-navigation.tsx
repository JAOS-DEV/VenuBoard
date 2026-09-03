"use client";

import { CalendarDays, House, MoreHorizontal, Users, Wind } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactElement } from "react";

import { Link, usePathname } from "@/core/i18n/navigation";
import { cn } from "@/lib/utils";

export interface AdminNavItem {
  href: string;
  key: "home" | "staff" | "events" | "atmosphere";
}

interface MobileNavigationProps {
  items: readonly AdminNavItem[];
  onMore: () => void;
  moreLabel: string;
}

export function MobileNavigation({
  items,
  onMore,
  moreLabel,
}: MobileNavigationProps): ReactElement {
  const t = useTranslations("adminNav");
  const pathname = usePathname();

  const icons = {
    home: House,
    staff: Users,
    events: CalendarDays,
    atmosphere: Wind,
  } as const;

  return (
    <nav
      aria-label={t("primary")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
    >
      <ul
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${String(items.length + 1)}, minmax(0, 1fr))`,
        }}
      >
        {items.map((item) => {
          const Icon = icons[item.key];
          const active =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex min-h-11 flex-col items-center justify-center gap-0.5 px-2 py-2 text-[11px]",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="size-5" aria-hidden="true" />
                {t(item.key)}
              </Link>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            onClick={onMore}
            className="flex min-h-11 w-full flex-col items-center justify-center gap-0.5 px-2 py-2 text-[11px] text-muted-foreground"
          >
            <MoreHorizontal className="size-5" aria-hidden="true" />
            {moreLabel}
          </button>
        </li>
      </ul>
    </nav>
  );
}
