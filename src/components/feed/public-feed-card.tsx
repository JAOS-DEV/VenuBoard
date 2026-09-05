import { formatFeedPublicDate } from "@/core/feed/labels";
import type { PublicFeedItem } from "@/core/feed/public-types";

interface PublicFeedCardProps {
  item: PublicFeedItem;
  locale: "en" | "th";
  typeLabel: string;
  pinnedLabel: string;
  compact?: boolean;
}

export function PublicFeedCard({
  item,
  locale,
  typeLabel,
  pinnedLabel,
  compact = false,
}: PublicFeedCardProps): React.ReactElement {
  return (
    <article
      className={
        compact
          ? "rounded-lg border border-border bg-card p-3"
          : "rounded-lg border border-border bg-card p-4"
      }
      data-testid="public-feed-card"
      data-feed-type={item.postType}
      data-feed-pinned={item.isPinned ? "true" : "false"}
    >
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>{typeLabel}</span>
        <span aria-hidden="true">·</span>
        <time dateTime={item.publishedAt}>
          {formatFeedPublicDate(item.publishedAt, locale)}
        </time>
        {item.isPinned ? (
          <span className="font-medium text-foreground">{pinnedLabel}</span>
        ) : null}
      </div>
      <h3 className="mt-1 text-base font-semibold tracking-tight">
        {item.title}
      </h3>
      <p
        className={
          compact
            ? "mt-1 line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground"
            : "mt-2 whitespace-pre-wrap text-sm text-muted-foreground"
        }
      >
        {item.body}
      </p>
    </article>
  );
}
