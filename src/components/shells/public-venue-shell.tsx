"use client";

import { useTranslations } from "next-intl";

import { CompactChrome } from "@/components/patterns/compact-chrome";
import { PageContainer } from "@/components/patterns/page-container";
import type { VenuBoardEnvironment } from "@/core/env/environment";

interface PublicVenueShellProps {
  environment: VenuBoardEnvironment;
  signedIn: boolean;
  developerHubEnabled: boolean;
  children: React.ReactNode;
}

export function PublicVenueShell({
  environment,
  signedIn,
  developerHubEnabled,
  children,
}: PublicVenueShellProps): React.ReactElement {
  const tApp = useTranslations("app");

  return (
    <CompactChrome
      identityHref="/"
      identityLabel={tApp("name")}
      environment={environment}
      signedIn={signedIn}
      developerHubEnabled={developerHubEnabled}
      showDeveloperHub={false}
      localNotice={developerHubEnabled ? "dot" : "none"}
    >
      <PageContainer width="default">{children}</PageContainer>
    </CompactChrome>
  );
}
