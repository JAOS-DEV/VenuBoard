import { getTranslations } from "next-intl/server";

import { PublicBookingForm } from "@/components/booking-requests/public-booking-form";
import { PublicVenueBackLink } from "@/components/patterns/public-venue-back-link";
import { VenueBrandScope } from "@/components/patterns/venue-brand-scope";
import { loadPublicBookingIntake } from "@/core/booking-requests/queries";
import { resolveRequestLocale } from "@/core/i18n/server";
import { publicVenueHomePath } from "@/core/public-venue/paths";
import { loadPublicVenueSnapshot } from "@/core/staff-presence/queries";

export const dynamic = "force-dynamic";

interface PublicEnquirePageProps {
  params: Promise<{ locale: string; venueSlug: string }>;
}

export default async function PublicEnquirePage({
  params,
}: PublicEnquirePageProps): Promise<React.ReactElement> {
  const { venueSlug } = await params;
  const locale = await resolveRequestLocale(params);
  const t = await getTranslations("bookingPublic");
  const tVenue = await getTranslations("publicVenue");
  const venue = await loadPublicVenueSnapshot(venueSlug);
  const intake = await loadPublicBookingIntake(venueSlug, locale);
  const formLocale = locale === "th" ? "th" : "en";
  const homeHref = publicVenueHomePath(venueSlug);
  const venueName =
    intake.venueName || (venue?.name ?? tVenue("unavailableTitle"));

  return (
    <VenueBrandScope branding={venue?.branding ?? null} className="space-y-6">
      {homeHref !== null ? (
        <PublicVenueBackLink
          href={homeHref}
          label={tVenue("backToVenue", { venueName })}
        />
      ) : null}
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {intake.heading ?? t("headingFallback")}
        </h1>
      </header>

      {venue?.contentClassification === "nightlife_18_plus" ? (
        <aside
          className="rounded-lg border border-border bg-secondary/60 p-3 text-sm"
          data-testid="adult-notice"
        >
          <p className="font-medium">{tVenue("adultNoticeTitle")}</p>
          <p className="mt-1 text-muted-foreground">
            {tVenue("adultNoticeBody")}
          </p>
        </aside>
      ) : null}

      {!intake.available ? (
        <p className="text-sm text-muted-foreground">{t("unavailable")}</p>
      ) : !intake.accepting ? (
        <p className="text-sm text-muted-foreground">{t("paused")}</p>
      ) : (
        <>
          {intake.instructions !== null ? (
            <p className="text-sm text-muted-foreground">
              {intake.instructions}
            </p>
          ) : null}
          <PublicBookingForm intake={intake} locale={formLocale} />
        </>
      )}
    </VenueBrandScope>
  );
}
