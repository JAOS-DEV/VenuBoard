import { getTranslations } from "next-intl/server";

import { PublicAtmosphereCard } from "@/components/atmosphere/public-atmosphere-card";
import { PublicBookingCta } from "@/components/booking-requests/public-booking-cta";
import { PublicFeedPreview } from "@/components/feed/public-feed-preview";
import { PublicOffersPreview } from "@/components/offers/public-offers-preview";
import { StaffCarousel } from "@/components/staff-presence/staff-carousel";
import { VenueBrandScope } from "@/components/patterns/venue-brand-scope";
import { resolveRequestLocale } from "@/core/i18n/server";
import { loadPublicVenueAtmosphere } from "@/core/atmosphere/queries";
import { loadPublicBookingIntake } from "@/core/booking-requests/queries";
import { loadPublicVenueFeed } from "@/core/feed/queries";
import { loadPublicVenueOffers } from "@/core/offers/queries";
import { atmospherePublicCopyKey } from "@/core/atmosphere/labels";
import {
  loadPublicVenueArchiveEvents,
  loadPublicVenueUpcomingEvents,
} from "@/core/events/queries";
import { VenueEventsSection } from "@/components/events/venue-events-section";
import { PublicVenueProfileBlock } from "@/components/venue-profile/public-venue-profile-block";
import {
  loadPublicStaffCarousel,
  loadPublicVenueSnapshot,
} from "@/core/staff-presence/queries";
import { loadPublicVenueProfile } from "@/core/venue-profile/queries";

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
  const tAtmosphere = await getTranslations("atmospherePublic");
  const tFeed = await getTranslations("feedPublic");
  const tOffers = await getTranslations("offersPublic");
  const tBooking = await getTranslations("bookingPublic");

  const venue = await loadPublicVenueSnapshot(venueSlug);
  const profile = await loadPublicVenueProfile(venueSlug, locale);
  const atmosphere = await loadPublicVenueAtmosphere(venueSlug, locale);
  const feed = await loadPublicVenueFeed(venueSlug, locale);
  const offers = await loadPublicVenueOffers(venueSlug, locale);
  const booking = await loadPublicBookingIntake(venueSlug, locale);
  const carousel = await loadPublicStaffCarousel(venueSlug, locale);
  const eventsUpcoming = await loadPublicVenueUpcomingEvents(venueSlug, locale);
  const eventsArchive = eventsUpcoming.showPastArchive
    ? await loadPublicVenueArchiveEvents(venueSlug, locale)
    : null;

  return (
    <VenueBrandScope branding={venue?.branding ?? null} className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("title")}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {profile.available
            ? profile.name
            : (venue?.name ?? t("unavailableTitle"))}
        </h1>
        {venue === null && !profile.available ? (
          <p className="text-sm text-muted-foreground">
            {t("unavailableBody")}
          </p>
        ) : null}
      </header>

      <PublicVenueProfileBlock
        profile={profile}
        copy={{
          preview: t("previewBanner"),
          about: t("about"),
          contact: t("contact"),
          hours: t("hours"),
          timezone: t("timezone"),
          getDirections: t("getDirections"),
          email: t("email"),
          phone: t("phone"),
          website: t("website"),
          hoursUnknown: t("hoursUnknown"),
          hoursOpenListed: t("hoursOpenListed"),
          hoursClosedListed: t("hoursClosedListed"),
          closed: t("closed"),
          nextDay: t("nextDay"),
          weekdays: {
            monday: t("monday"),
            tuesday: t("tuesday"),
            wednesday: t("wednesday"),
            thursday: t("thursday"),
            friday: t("friday"),
            saturday: t("saturday"),
            sunday: t("sunday"),
          },
          listedHoursDisclaimer: t("listedHoursDisclaimer"),
          exceptions: t("hoursExceptions"),
        }}
      />

      {(profile.available
        ? profile.contentClassification
        : venue?.contentClassification) === "nightlife_18_plus" ? (
        <aside
          className="rounded-lg border border-border bg-secondary/60 p-3 text-sm"
          data-testid="adult-notice"
        >
          <p className="font-medium">{t("adultNoticeTitle")}</p>
          <p className="mt-1 text-muted-foreground">{t("adultNoticeBody")}</p>
        </aside>
      ) : null}

      <PublicAtmosphereCard
        atmosphere={atmosphere}
        statusLabel={
          atmosphere.statusKey === null
            ? ""
            : tAtmosphere(atmospherePublicCopyKey(atmosphere.statusKey))
        }
        headingFallback={tAtmosphere("headingFallback")}
        disclaimer={tAtmosphere("disclaimer")}
        freshnessLabel={tAtmosphere("freshness")}
      />

      <PublicFeedPreview
        feed={feed}
        locale={locale === "th" ? "th" : "en"}
        headingFallback={tFeed("headingFallback")}
        viewAllLabel={tFeed("viewAll")}
        venueSlug={venueSlug}
        typeLabels={{
          update: tFeed("typeUpdate"),
          announcement: tFeed("typeAnnouncement"),
          notice: tFeed("typeNotice"),
        }}
        pinnedLabel={tFeed("pinned")}
      />

      <PublicOffersPreview
        offers={offers}
        locale={locale === "th" ? "th" : "en"}
        headingFallback={tOffers("headingFallback")}
        viewAllLabel={tOffers("viewAll")}
        validityLabel={tOffers("validity")}
        venueSlug={venueSlug}
      />

      <PublicBookingCta
        intake={booking}
        headingFallback={tBooking("headingFallback")}
        ctaLabel={tBooking("cta")}
        intro={tBooking("intro")}
      />

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

      <VenueEventsSection
        locale={locale}
        upcoming={eventsUpcoming}
        archive={eventsArchive}
        branding={venue?.branding ?? null}
      />
    </VenueBrandScope>
  );
}
