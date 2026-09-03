"use client";

import { useTranslations } from "next-intl";

import { CompactChrome } from "@/components/patterns/compact-chrome";
import { PageContainer } from "@/components/patterns/page-container";
import type { VenuBoardEnvironment } from "@/core/env/environment";

interface AppShellProps {
  environment: VenuBoardEnvironment;
  signedIn: boolean;
  developerHubEnabled: boolean;
  children: React.ReactNode;
}

/**
 * Product/internal shell for overview and ungrouped routes.
 * Public venue, venue-admin and platform use purpose-specific shells.
 */
export function AppShell({
  environment,
  signedIn,
  developerHubEnabled,
  children,
}: AppShellProps): React.ReactElement {
  const tApp = useTranslations("app");
  const tNav = useTranslations("nav");
  const t = useTranslations("shell");

  return (
    <CompactChrome
      identityHref="/"
      identityLabel={tApp("name")}
      identityDescription={tApp("tagline")}
      environment={environment}
      signedIn={signedIn}
      developerHubEnabled={developerHubEnabled}
      showDeveloperHub={developerHubEnabled}
      surfacesLabel={t("surfaces")}
      surfaces={[
        { href: "/", label: tNav("home") },
        { href: "/v/harbor-light", label: tNav("publicSite") },
        { href: "/admin", label: tNav("admin") },
        { href: "/platform", label: tNav("platform") },
      ]}
      localNotice="banner"
      footer
    >
      <PageContainer>{children}</PageContainer>
    </CompactChrome>
  );
}
