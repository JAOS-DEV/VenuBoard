"use client";

import { useTranslations } from "next-intl";

import { CompactChrome } from "@/components/patterns/compact-chrome";
import { PageContainer } from "@/components/patterns/page-container";
import type { VenuBoardEnvironment } from "@/core/env/environment";

interface AuthShellProps {
  environment: VenuBoardEnvironment;
  signedIn: boolean;
  developerHubEnabled: boolean;
  children: React.ReactNode;
}

export function AuthShell({
  environment,
  signedIn,
  developerHubEnabled,
  children,
}: AuthShellProps): React.ReactElement {
  const tApp = useTranslations("app");

  return (
    <CompactChrome
      identityHref="/"
      identityLabel={tApp("name")}
      identityDescription={tApp("tagline")}
      environment={environment}
      signedIn={signedIn}
      developerHubEnabled={developerHubEnabled}
      showDeveloperHub={developerHubEnabled}
      localNotice={developerHubEnabled ? "dot" : "none"}
    >
      <PageContainer width="narrow" className="flex items-start py-8">
        {children}
      </PageContainer>
    </CompactChrome>
  );
}
