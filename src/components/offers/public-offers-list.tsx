"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { loadMorePublicOffersAction } from "@/core/offers/actions";
import { livePublicOffers } from "@/core/offers/expiry";
import type {
  PublicOfferItem,
  PublicVenueOffersPayload,
} from "@/core/offers/public-types";
import { PublicOfferCard } from "./public-offer-card";
import { PublicOfferExpiryWatcher } from "./public-offer-expiry-watcher";

interface PublicOffersListProps {
  venueSlug: string;
  locale: "en" | "th";
  initial: PublicVenueOffersPayload;
}

export function PublicOffersList({
  venueSlug,
  locale,
  initial,
}: PublicOffersListProps): React.ReactElement {
  const t = useTranslations("offersPublic");
  const [items, setItems] = useState<PublicOfferItem[]>(initial.items);
  const [cursor, setCursor] = useState<string | null>(initial.nextCursor);
  const [loading, setLoading] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [seenInitial, setSeenInitial] = useState(initial);
  const onTick = useCallback(() => {
    setNowMs(Date.now());
  }, []);

  if (
    initial.items !== seenInitial.items ||
    initial.nextCursor !== seenInitial.nextCursor
  ) {
    setSeenInitial(initial);
    setItems(initial.items);
    setCursor(initial.nextCursor);
  }

  async function loadMore(): Promise<void> {
    if (cursor === null || loading) {
      return;
    }
    setLoading(true);
    const next = await loadMorePublicOffersAction({
      venueSlug,
      locale,
      cursor,
    });
    setItems((current) => [...current, ...next.items]);
    setCursor(next.nextCursor);
    setLoading(false);
  }

  const visible = livePublicOffers(items, nowMs);

  if (visible.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("empty")}</p>;
  }

  return (
    <div className="space-y-4">
      <PublicOfferExpiryWatcher items={items} onTick={onTick} />
      <ul className="space-y-3">
        {visible.map((item) => (
          <li key={`${item.validFrom}-${item.title}-${item.validUntil}`}>
            <PublicOfferCard
              item={item}
              locale={locale}
              timezone={initial.timezone}
              validityLabel={t("validity")}
              termsLabel={t("terms")}
            />
          </li>
        ))}
      </ul>
      {cursor !== null ? (
        <Button
          type="button"
          variant="secondary"
          className="min-h-11 w-full"
          disabled={loading}
          onClick={() => {
            void loadMore();
          }}
        >
          {t("loadMore")}
        </Button>
      ) : null}
    </div>
  );
}
