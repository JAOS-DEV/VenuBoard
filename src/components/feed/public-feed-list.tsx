"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { loadMorePublicFeedAction } from "@/core/feed/actions";
import type {
  PublicFeedItem,
  PublicVenueFeedPayload,
} from "@/core/feed/public-types";
import { PublicFeedCard } from "./public-feed-card";

interface PublicFeedListProps {
  venueSlug: string;
  locale: "en" | "th";
  initial: PublicVenueFeedPayload;
}

export function PublicFeedList({
  venueSlug,
  locale,
  initial,
}: PublicFeedListProps): React.ReactElement {
  const t = useTranslations("feedPublic");
  const [items, setItems] = useState<PublicFeedItem[]>(initial.items);
  const [cursor, setCursor] = useState<string | null>(initial.nextCursor);
  const [loading, setLoading] = useState(false);

  async function loadMore(): Promise<void> {
    if (cursor === null || loading) {
      return;
    }
    setLoading(true);
    const next = await loadMorePublicFeedAction({
      venueSlug,
      locale,
      cursor,
    });
    setItems((current) => [...current, ...next.items]);
    setCursor(next.nextCursor);
    setLoading(false);
  }

  const typeLabels = {
    update: t("typeUpdate"),
    announcement: t("typeAnnouncement"),
    notice: t("typeNotice"),
  };

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("empty")}</p>;
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={`${item.publishedAt}-${item.title}-${item.postType}`}>
            <PublicFeedCard
              item={item}
              locale={locale}
              typeLabel={typeLabels[item.postType]}
              pinnedLabel={t("pinned")}
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
