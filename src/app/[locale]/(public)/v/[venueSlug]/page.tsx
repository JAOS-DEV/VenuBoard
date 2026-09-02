import { getTranslations } from "next-intl/server";

import { StaffCarousel } from "@/components/staff-presence/staff-carousel";
import { Badge } from "@/components/ui/badge";
import { resolveRequestLocale } from "@/core/i18n/server";
import {
  loadPublicStaffCarousel,
  loadPublicVenueSnapshot,
} from "@/core/staff-presence/queries";

export const dynamic = "force-dynamic";

interface PublicVenuePageProps {
  params: Promise<{ locale: string; venueSlug: string }>;
}

export default async function PublicVenuePage({
  params,
}: PublicVenuePageProps): Promise<React.ReactElement> {
  const { venueSlug } = await params;
  const locale = await resolveRequestLocale(params);
  const t = await getTranslations("publicVenue");
  const tStaff = await getTranslations("staffPublic");

  const venue = await loadPublicVenueSnapshot(venueSlug);
  const carousel = await loadPublicStaffCarousel(venueSlug, locale);

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <Badge variant="outline">{t("developmentFallback")}</Badge>
        <h1 className="text-2xl font-semibold tracking-tight">
          {venue?.name ?? t("unavailableTitle")}
        </h1>
        {venue !== null ? (
          <p className="font-mono text-sm text-muted-foreground">
            {venue.slug}
          </p>
        ) : (
          <p className="text-muted-foreground">{t("unavailableBody")}</p>
        )}
      </header>

      {venue?.contentClassification === "nightlife_18_plus" ? (
        <aside
          className="rounded-md border border-border bg-secondary p-4 text-sm"
          data-testid="adult-notice"
        >
          <p className="font-medium">{t("adultNoticeTitle")}</p>
          <p className="mt-1 text-muted-foreground">{t("adultNoticeBody")}</p>
        </aside>
      ) : null}

      <StaffCarousel
        carousel={carousel}
        headingFallback={tStaff("headingFallback")}
        inNowLabel={tStaff("inNow")}
        notInLabel={tStaff("notIn")}
        emptyLabel={tStaff("empty")}
        previousLabel={tStaff("previous")}
        nextLabel={tStaff("next")}
        pauseLabel={tStaff("pause")}
        playLabel={tStaff("play")}
        branding={venue?.branding ?? null}
      />
    </div>
  );
}
