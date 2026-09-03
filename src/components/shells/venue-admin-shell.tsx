"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import {
  MobileNavigation,
  type AdminNavItem,
} from "@/components/patterns/mobile-navigation";
import { CompactChrome } from "@/components/patterns/compact-chrome";
import { PageContainer } from "@/components/patterns/page-container";
import type { VenuBoardEnvironment } from "@/core/env/environment";

interface VenueAdminShellProps {
  environment: VenuBoardEnvironment;
  signedIn: boolean;
  developerHubEnabled: boolean;
  showStaff: boolean;
  showEvents: boolean;
  children: React.ReactNode;
}

export function VenueAdminShell({
  environment,
  signedIn,
  developerHubEnabled,
  showStaff,
  showEvents,
  children,
}: VenueAdminShellProps): React.ReactElement {
  const tApp = useTranslations("app");
  const tNav = useTranslations("nav");
  const tAdmin = useTranslations("adminNav");
  const t = useTranslations("shell");
  const [moreOpen, setMoreOpen] = useState(false);

  const items: AdminNavItem[] = [
    { href: "/admin", key: "home" },
    ...(showStaff ? [{ href: "/admin/staff", key: "staff" as const }] : []),
    ...(showEvents ? [{ href: "/admin/events", key: "events" as const }] : []),
  ];

  const desktopSurfaces = [
    { href: "/admin", label: tAdmin("home") },
    ...(showStaff ? [{ href: "/admin/staff", label: tAdmin("staff") }] : []),
    ...(showEvents ? [{ href: "/admin/events", label: tAdmin("events") }] : []),
    { href: "/", label: tNav("home") },
  ];

  return (
    <CompactChrome
      identityHref="/admin"
      identityLabel={tApp("name")}
      identityDescription={tNav("admin")}
      environment={environment}
      signedIn={signedIn}
      developerHubEnabled={developerHubEnabled}
      showDeveloperHub={developerHubEnabled}
      surfaces={desktopSurfaces}
      surfacesLabel={t("surfaces")}
      extraLinks={
        developerHubEnabled ? [{ href: "/dev/ui", label: t("uiGallery") }] : []
      }
      localNotice="banner"
      hideMenuButton
      menuOpen={moreOpen}
      onMenuOpenChange={setMoreOpen}
      bottomNav={
        <MobileNavigation
          items={items}
          onMore={() => {
            setMoreOpen(true);
          }}
          moreLabel={tAdmin("more")}
        />
      }
    >
      <PageContainer>{children}</PageContainer>
    </CompactChrome>
  );
}
