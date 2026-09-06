import { getTranslations } from "next-intl/server";

import { PublicVenueShell } from "@/components/shells/public-venue-shell";
import { loadPublicBookingIntake } from "@/core/booking-requests/queries";
import { loadPublicVenueFeed } from "@/core/feed/queries";
import { resolveRequestLocale } from "@/core/i18n/server";
import { loadPublicVenueOffers } from "@/core/offers/queries";
import { publicVenueDestinations } from "@/core/public-venue/destinations";
import {
  publicVenueEnquirePath,
  publicVenueHomePath,
  publicVenueOffersPath,
  publicVenueUpdatesPath,
} from "@/core/public-venue/paths";
import { loadShellSession } from "@/core/shell/session";
import { loadPublicVenueSnapshot } from "@/core/staff-presence/queries";

interface PublicVenueLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string; venueSlug: string }>;
}

export default async function PublicVenueLayout({
  children,
  params,
}: PublicVenueLayoutProps): Promise<React.ReactElement> {
  const { venueSlug } = await params;
  const locale = await resolveRequestLocale(params);
  const session = await loadShellSession();
  const t = await getTranslations("publicVenue");
  const tBooking = await getTranslations("bookingPublic");
  const venue = await loadPublicVenueSnapshot(venueSlug);
  const offers = await loadPublicVenueOffers(venueSlug, locale);
  const feed = await loadPublicVenueFeed(venueSlug, locale);
  const booking = await loadPublicBookingIntake(venueSlug, locale);
  const homeHref = publicVenueHomePath(venueSlug) ?? "/";
  const surfaces = publicVenueDestinations({
    homeHref,
    homeLabel: t("navHome"),
    offersHref: publicVenueOffersPath(venueSlug),
    offersLabel: t("navOffers"),
    offersAvailable: offers.available,
    updatesHref: publicVenueUpdatesPath(venueSlug),
    updatesLabel: t("navUpdates"),
    updatesAvailable: feed.available,
    enquireHref: publicVenueEnquirePath(venueSlug),
    enquireLabel: tBooking("cta"),
    enquireAvailable: booking.available,
    enquireAccepting: booking.accepting,
  });

  return (
    <PublicVenueShell
      environment={session.environment}
      signedIn={session.signedIn}
      developerHubEnabled={session.developerHubEnabled}
      identityHref={homeHref}
      identityLabel={venue?.name ?? t("unavailableTitle")}
      surfaces={surfaces}
      surfacesLabel={t("navLabel")}
      venueSlug={venueSlug}
      locale={locale}
    >
      {children}
    </PublicVenueShell>
  );
}
