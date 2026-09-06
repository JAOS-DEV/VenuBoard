"use client";

import {
  CompactChrome,
  type ShellLink,
} from "@/components/patterns/compact-chrome";
import { PageContainer } from "@/components/patterns/page-container";
import { PublicVenueScrollManager } from "@/components/patterns/public-venue-scroll-manager";
import type { VenuBoardEnvironment } from "@/core/env/environment";
import type { AppLocale } from "@/core/i18n/routing";

interface PublicVenueShellProps {
  environment: VenuBoardEnvironment;
  signedIn: boolean;
  developerHubEnabled: boolean;
  identityHref: string;
  identityLabel: string;
  surfaces: readonly ShellLink[];
  surfacesLabel: string;
  venueSlug: string;
  locale: AppLocale;
  children: React.ReactNode;
}

export function PublicVenueShell({
  environment,
  signedIn,
  developerHubEnabled,
  identityHref,
  identityLabel,
  surfaces,
  surfacesLabel,
  venueSlug,
  locale,
  children,
}: PublicVenueShellProps): React.ReactElement {
  return (
    <PublicVenueScrollManager venueSlug={venueSlug} locale={locale}>
      <CompactChrome
        identityHref={identityHref}
        identityLabel={identityLabel}
        identityScroll={false}
        environment={environment}
        signedIn={signedIn}
        developerHubEnabled={developerHubEnabled}
        showDeveloperHub={false}
        surfaces={surfaces}
        surfacesLabel={surfacesLabel}
        extraLinks={[]}
        localNotice={developerHubEnabled ? "dot" : "none"}
      >
        <PageContainer width="default">{children}</PageContainer>
      </CompactChrome>
    </PublicVenueScrollManager>
  );
}
