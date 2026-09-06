"use client";

import { useCallback, useState } from "react";

import { PublicModuleHeading } from "@/components/patterns/public-module-heading";
import { Link } from "@/core/i18n/navigation";
import { livePublicOffers } from "@/core/offers/expiry";
import { publicVenueOffersPath } from "@/core/offers/public-path";
import type { PublicVenueOffersPayload } from "@/core/offers/public-types";
import { PublicOfferCard } from "./public-offer-card";
import { PublicOfferExpiryWatcher } from "./public-offer-expiry-watcher";

interface PublicOffersPreviewProps {
  offers: PublicVenueOffersPayload;
  locale: "en" | "th";
  headingFallback: string;
  viewAllLabel: string;
  validityLabel: string;
  venueSlug: string;
}

export function PublicOffersPreview({
  offers,
  locale,
  headingFallback,
  viewAllLabel,
  validityLabel,
  venueSlug,
}: PublicOffersPreviewProps): React.ReactElement | null {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const onTick = useCallback(() => {
    setNowMs(Date.now());
  }, []);
  const live = livePublicOffers(offers.items, nowMs).slice(
    0,
    offers.previewCount,
  );

  if (!offers.available || !offers.previewEnabled || live.length === 0) {
    return null;
  }

  const href = publicVenueOffersPath(venueSlug);

  return (
    <section className="space-y-3" data-testid="public-offers-preview">
      <PublicOfferExpiryWatcher items={offers.items} onTick={onTick} />
      <div className="flex items-end justify-between gap-3">
        <PublicModuleHeading label={headingFallback} heading={offers.heading} />
        {href !== null ? (
          <Link
            href={href}
            className="inline-flex min-h-11 shrink-0 items-center text-sm font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {viewAllLabel}
          </Link>
        ) : null}
      </div>
      <ul className="space-y-3">
        {live.map((item) => (
          <li key={`${item.validFrom}-${item.title}`}>
            <PublicOfferCard
              item={item}
              locale={locale}
              timezone={offers.timezone}
              validityLabel={validityLabel}
              compact
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
