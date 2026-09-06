import { PublicModuleHeading } from "@/components/patterns/public-module-heading";
import { Link } from "@/core/i18n/navigation";
import type { PublicVenueFeedPayload } from "@/core/feed/public-types";
import { publicVenueUpdatesPath } from "@/core/feed/public-path";
import { PublicFeedCard } from "./public-feed-card";

interface PublicFeedPreviewProps {
  feed: PublicVenueFeedPayload;
  locale: "en" | "th";
  headingFallback: string;
  viewAllLabel: string;
  venueSlug: string;
  typeLabels: {
    update: string;
    announcement: string;
    notice: string;
  };
  pinnedLabel: string;
}

export function PublicFeedPreview({
  feed,
  locale,
  headingFallback,
  viewAllLabel,
  venueSlug,
  typeLabels,
  pinnedLabel,
}: PublicFeedPreviewProps): React.ReactElement | null {
  if (!feed.available || !feed.previewEnabled || feed.items.length === 0) {
    return null;
  }

  const preview = feed.items.slice(0, feed.previewCount);
  const href = publicVenueUpdatesPath(venueSlug);

  return (
    <section className="space-y-3" data-testid="public-feed-preview">
      <div className="flex items-end justify-between gap-3">
        <PublicModuleHeading label={headingFallback} heading={feed.heading} />
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
        {preview.map((item) => (
          <li key={`${item.publishedAt}-${item.title}`}>
            <PublicFeedCard
              item={item}
              locale={locale}
              typeLabel={typeLabels[item.postType]}
              pinnedLabel={pinnedLabel}
              compact
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
