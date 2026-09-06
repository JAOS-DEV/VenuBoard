import { getTranslations } from "next-intl/server";

import { PublicOffersList } from "@/components/offers/public-offers-list";
import { PublicModuleHeading } from "@/components/patterns/public-module-heading";
import { PublicVenueBackLink } from "@/components/patterns/public-venue-back-link";
import { VenueBrandScope } from "@/components/patterns/venue-brand-scope";
import { resolveRequestLocale } from "@/core/i18n/server";
import { loadPublicVenueOffers } from "@/core/offers/queries";
import { publicVenueHomePath } from "@/core/public-venue/paths";
import { loadPublicVenueSnapshot } from "@/core/staff-presence/queries";

export const dynamic = "force-dynamic";

interface PublicOffersPageProps {
  params: Promise<{ locale: string; venueSlug: string }>;
}

export default async function PublicOffersPage({
  params,
}: PublicOffersPageProps): Promise<React.ReactElement> {
  const { venueSlug } = await params;
  const locale = await resolveRequestLocale(params);
  const t = await getTranslations("offersPublic");
  const tVenue = await getTranslations("publicVenue");
  const venue = await loadPublicVenueSnapshot(venueSlug);
  const offers = await loadPublicVenueOffers(venueSlug, locale);
  const homeHref = publicVenueHomePath(venueSlug);
  const venueName = venue?.name ?? tVenue("unavailableTitle");

  return (
    <VenueBrandScope branding={venue?.branding ?? null} className="space-y-6">
      {homeHref !== null ? (
        <PublicVenueBackLink
          href={homeHref}
          label={tVenue("backToVenue", { venueName })}
        />
      ) : null}
      <header className="space-y-2">
        <PublicModuleHeading
          as="h1"
          label={t("headingFallback")}
          heading={offers.heading}
        />
        <p className="text-sm text-muted-foreground">{t("intro")}</p>
      </header>
      {venue?.contentClassification === "nightlife_18_plus" ? (
        <aside
          className="rounded-lg border border-border bg-secondary/60 p-3 text-sm"
          data-testid="adult-notice"
        >
          <p className="font-medium">{t("adultIndependent")}</p>
        </aside>
      ) : null}
      {offers.available ? (
        <PublicOffersList
          venueSlug={venueSlug}
          locale={locale === "th" ? "th" : "en"}
          initial={offers}
        />
      ) : (
        <p className="text-sm text-muted-foreground">{t("unavailable")}</p>
      )}
    </VenueBrandScope>
  );
}
