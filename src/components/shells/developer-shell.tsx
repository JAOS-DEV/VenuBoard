"use client";

import { useTranslations } from "next-intl";

import { CompactChrome } from "@/components/patterns/compact-chrome";
import { PageContainer } from "@/components/patterns/page-container";
import type { VenuBoardEnvironment } from "@/core/env/environment";

interface DeveloperShellProps {
  environment: VenuBoardEnvironment;
  signedIn: boolean;
  developerHubEnabled: boolean;
  children: React.ReactNode;
}

export function DeveloperShell({
  environment,
  signedIn,
  developerHubEnabled,
  children,
}: DeveloperShellProps): React.ReactElement {
  const tApp = useTranslations("app");
  const t = useTranslations("shell");

  return (
    <CompactChrome
      identityHref="/dev"
      identityLabel={tApp("name")}
      identityDescription={tApp("tagline")}
      environment={environment}
      signedIn={signedIn}
      developerHubEnabled={developerHubEnabled}
      showDeveloperHub={developerHubEnabled}
      surfaces={[
        { href: "/dev", label: t("developerHub") },
        { href: "/dev/ui", label: t("uiGallery") },
        { href: "/sign-in", label: t("signInShort") },
      ]}
      surfacesLabel={t("surfaces")}
      localNotice="banner"
    >
      <PageContainer width="wide">{children}</PageContainer>
    </CompactChrome>
  );
}
