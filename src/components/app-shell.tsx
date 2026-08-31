import { useTranslations } from "next-intl";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { EnvironmentBadge } from "@/components/environment-badge";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Badge } from "@/components/ui/badge";
import type { VenuBoardEnvironment } from "@/core/env/environment";
import { Link } from "@/core/i18n/navigation";

interface AppShellProps {
  environment: VenuBoardEnvironment;
  signedIn: boolean;
  children: React.ReactNode;
}

const SURFACES = [
  { href: "/", key: "home" },
  { href: "/v/example-venue", key: "publicSite" },
  { href: "/admin", key: "admin" },
  { href: "/platform", key: "platform" },
] as const;

/**
 * Shared shell: header, surface links, locale switcher, and session controls.
 * Product modules are still absent; admin and platform routes are now
 * authentication-gated.
 */
export function AppShell({
  environment,
  signedIn,
  children,
}: AppShellProps): React.ReactElement {
  const t = useTranslations("shell");
  const tNav = useTranslations("nav");
  const tApp = useTranslations("app");
  const tAuth = useTranslations("auth");

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:ring-2 focus:ring-ring"
      >
        {t("skipToContent")}
      </a>

      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-3 px-4 py-4 sm:px-6">
          <Link href="/" className="flex flex-col">
            <span className="text-base font-semibold">{tApp("name")}</span>
            <span className="text-xs text-muted-foreground">
              {tApp("tagline")}
            </span>
          </Link>

          <div className="ms-auto flex items-center gap-2">
            <EnvironmentBadge
              environment={environment}
              label={t("environment")}
            />
            {signedIn ? (
              <SignOutButton />
            ) : (
              <Link
                href="/sign-in"
                className="inline-flex h-11 items-center px-3 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {tAuth("signIn")}
              </Link>
            )}
            <LocaleSwitcher />
          </div>
        </div>

        <nav
          aria-label={t("surfaces")}
          className="mx-auto w-full max-w-5xl px-4 pb-3 sm:px-6"
        >
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {SURFACES.map((surface) => (
              <li key={surface.href}>
                <Link
                  href={surface.href}
                  className="inline-flex h-11 items-center text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {tNav(surface.key)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <div
        role="status"
        className="border-b border-border bg-secondary px-4 py-2 text-center text-xs text-secondary-foreground sm:px-6"
      >
        {t("scaffoldNotice")}
      </div>

      <main
        id="main"
        className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6"
      >
        {children}
      </main>

      <footer className="border-t border-border px-4 py-6 sm:px-6">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <Badge variant="outline">{t("notImplemented")}</Badge>
          <span>{t("documentation")}: docs/</span>
        </div>
      </footer>
    </div>
  );
}
