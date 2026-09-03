"use client";

import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type ReactElement, type ReactNode } from "react";

import { EnvironmentBadge } from "@/components/environment-badge";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { AccountControls } from "@/components/patterns/account-controls";
import { ThemeSwitcher } from "@/components/patterns/theme-switcher";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { VenuBoardEnvironment } from "@/core/env/environment";
import { Link } from "@/core/i18n/navigation";
import { cn } from "@/lib/utils";

export interface ShellLink {
  href: string;
  label: string;
}

interface CompactChromeProps {
  identityHref: string;
  identityLabel: string;
  identityDescription?: string;
  environment: VenuBoardEnvironment;
  signedIn: boolean;
  developerHubEnabled: boolean;
  showDeveloperHub?: boolean;
  surfaces?: readonly ShellLink[] | null;
  surfacesLabel?: string;
  extraLinks?: readonly ShellLink[];
  localNotice?: "none" | "banner" | "dot";
  footer?: boolean;
  bottomNav?: ReactNode;
  hideMenuButton?: boolean;
  menuOpen?: boolean;
  onMenuOpenChange?: (open: boolean) => void;
  contentClassName?: string;
  children: ReactNode;
}

export function CompactChrome({
  identityHref,
  identityLabel,
  identityDescription,
  environment,
  signedIn,
  developerHubEnabled,
  showDeveloperHub = false,
  surfaces = null,
  surfacesLabel,
  extraLinks = [],
  localNotice = "none",
  footer = false,
  bottomNav = null,
  hideMenuButton = false,
  menuOpen: menuOpenProp,
  onMenuOpenChange,
  contentClassName,
  children,
}: CompactChromeProps): ReactElement {
  const t = useTranslations("shell");
  const tApp = useTranslations("app");
  const tAuth = useTranslations("auth");
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const menuOpen = menuOpenProp ?? uncontrolledOpen;
  const setMenuOpen = onMenuOpenChange ?? setUncontrolledOpen;
  const themeLabels = {
    theme: t("theme"),
    light: t("themeLight"),
    dark: t("themeDark"),
    system: t("themeSystem"),
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:ring-2 focus:ring-ring"
      >
        {t("skipToContent")}
      </a>

      <header className="sticky top-0 z-30 border-b border-border bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-2 px-4 sm:px-6">
          <Link href={identityHref} className="min-w-0 truncate font-semibold">
            {identityLabel}
            {identityDescription ? (
              <span className="sr-only"> — {identityDescription}</span>
            ) : null}
          </Link>

          <div className="ms-auto flex items-center gap-1">
            {localNotice === "dot" && developerHubEnabled ? (
              <span
                className="rounded-md bg-secondary px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-secondary-foreground"
                title={t("localNotice")}
              >
                {t("localShort")}
              </span>
            ) : (
              <EnvironmentBadge
                environment={environment}
                label={t("environment")}
              />
            )}
            <ThemeSwitcher compact labels={themeLabels} />
            <div className="hidden md:block">
              <LocaleSwitcher />
            </div>
            <AccountControls
              compact
              signedIn={signedIn}
              signInLabel={tAuth("signIn")}
            />
            {showDeveloperHub ? (
              <Button asChild variant="ghost" className="hidden md:inline-flex">
                <Link href="/dev">{t("developerHub")}</Link>
              </Button>
            ) : null}
            {hideMenuButton ? null : (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="md:hidden"
                aria-label={t("menu")}
                onClick={() => {
                  setMenuOpen(true);
                }}
              >
                <Menu />
              </Button>
            )}
          </div>
        </div>

        {surfaces !== null && surfaces.length > 0 ? (
          <nav
            aria-label={surfacesLabel ?? t("surfaces")}
            className="mx-auto hidden w-full max-w-5xl overflow-x-auto px-4 pb-2 md:block sm:px-6"
          >
            <ul className="flex flex-nowrap gap-1 text-sm">
              {surfaces.map((surface) => (
                <li key={surface.href}>
                  <Link
                    href={surface.href}
                    className="inline-flex h-11 items-center rounded-md px-3 text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    {surface.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </header>

      {localNotice === "banner" &&
      (developerHubEnabled || environment === "staging") ? (
        <div
          role="status"
          className="border-b border-border bg-secondary px-4 py-1.5 text-center text-xs text-secondary-foreground"
        >
          {developerHubEnabled ? t("localNotice") : t("stagingNotice")}
        </div>
      ) : null}

      <main
        id="main"
        className={cn(
          "flex-1",
          bottomNav !== null &&
            "pb-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom))]",
          contentClassName,
        )}
      >
        {children}
      </main>

      {footer ? (
        <footer className="border-t border-border px-4 py-3 sm:px-6">
          <div className="mx-auto w-full max-w-5xl text-xs text-muted-foreground">
            {t("documentation")}: docs/
          </div>
        </footer>
      ) : null}

      {bottomNav}

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="bottom" className="px-4">
          <SheetHeader>
            <SheetTitle>{t("menu")}</SheetTitle>
            <SheetDescription>{tApp("tagline")}</SheetDescription>
          </SheetHeader>
          {surfaces !== null && surfaces.length > 0 ? (
            <nav
              aria-label={surfacesLabel ?? t("surfaces")}
              className="flex flex-col gap-1 pb-3"
            >
              {surfaces.map((surface) => (
                <Link
                  key={surface.href}
                  href={surface.href}
                  className="inline-flex min-h-11 items-center rounded-md px-3 text-sm hover:bg-accent"
                  onClick={() => {
                    setMenuOpen(false);
                  }}
                >
                  {surface.label}
                </Link>
              ))}
            </nav>
          ) : null}
          {extraLinks.length > 0 || showDeveloperHub ? (
            <nav className="flex flex-col gap-1 pb-3">
              {extraLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="inline-flex min-h-11 items-center rounded-md px-3 text-sm hover:bg-accent"
                  onClick={() => {
                    setMenuOpen(false);
                  }}
                >
                  {link.label}
                </Link>
              ))}
              {showDeveloperHub ? (
                <Link
                  href="/dev"
                  className="inline-flex min-h-11 items-center rounded-md px-3 text-sm hover:bg-accent"
                  onClick={() => {
                    setMenuOpen(false);
                  }}
                >
                  {t("developerHub")}
                </Link>
              ) : null}
            </nav>
          ) : null}
          <div className="flex flex-col gap-3 pb-4">
            <LocaleSwitcher />
            <ThemeSwitcher labels={themeLabels} />
            <AccountControls
              signedIn={signedIn}
              signInLabel={tAuth("signIn")}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
