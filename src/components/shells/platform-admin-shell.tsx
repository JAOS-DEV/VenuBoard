"use client";

import { useTranslations } from "next-intl";

import { CompactChrome } from "@/components/patterns/compact-chrome";
import { PageContainer } from "@/components/patterns/page-container";
import type { VenuBoardEnvironment } from "@/core/env/environment";

interface PlatformAdminShellProps {
  environment: VenuBoardEnvironment;
  signedIn: boolean;
  developerHubEnabled: boolean;
  canOnboard: boolean;
  children: React.ReactNode;
}

export function PlatformAdminShell({
  environment,
  signedIn,
  developerHubEnabled,
  canOnboard,
  children,
}: PlatformAdminShellProps): React.ReactElement {
  const tApp = useTranslations("app");
  const tNav = useTranslations("nav");
  const tPlatform = useTranslations("platformNav");
  const t = useTranslations("shell");

  const surfaces = [
    { href: "/platform", label: tPlatform("overview") },
    ...(canOnboard
      ? [{ href: "/platform/onboard", label: tPlatform("onboard") }]
      : []),
    { href: "/", label: tNav("home") },
  ];

  return (
    <CompactChrome
      identityHref="/platform"
      identityLabel={tApp("name")}
      identityDescription={tNav("platform")}
      environment={environment}
      signedIn={signedIn}
      developerHubEnabled={developerHubEnabled}
      showDeveloperHub={developerHubEnabled}
      surfaces={surfaces}
      surfacesLabel={t("surfaces")}
      localNotice="banner"
    >
      <PageContainer>{children}</PageContainer>
    </CompactChrome>
  );
}
