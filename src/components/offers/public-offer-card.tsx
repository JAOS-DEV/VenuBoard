import { formatOfferValidityRange } from "@/core/offers/labels";
import type { PublicOfferItem } from "@/core/offers/public-types";

interface PublicOfferCardProps {
  item: PublicOfferItem;
  locale: "en" | "th";
  timezone: string;
  validityLabel: string;
  termsLabel?: string;
  compact?: boolean;
}

export function PublicOfferCard({
  item,
  locale,
  timezone,
  validityLabel,
  termsLabel,
  compact = false,
}: PublicOfferCardProps): React.ReactElement {
  return (
    <article
      className={
        compact
          ? "rounded-lg border border-border bg-card p-3"
          : "rounded-lg border border-border bg-card p-4"
      }
      data-testid="public-offer-card"
      data-valid-until={item.validUntil}
    >
      <p className="text-xs text-muted-foreground">
        {validityLabel}
        <span aria-hidden="true"> · </span>
        <time dateTime={item.validFrom}>
          {formatOfferValidityRange(
            item.validFrom,
            item.validUntil,
            locale,
            timezone,
          )}
        </time>
      </p>
      <h3 className="mt-1 text-base font-semibold tracking-tight">
        {item.title}
      </h3>
      <p
        className={
          compact
            ? "mt-1 line-clamp-2 whitespace-pre-wrap text-sm text-muted-foreground"
            : "mt-2 whitespace-pre-wrap text-sm text-muted-foreground"
        }
      >
        {item.description}
      </p>
      {compact ? null : (
        <div className="mt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {termsLabel ?? validityLabel}
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{item.terms}</p>
        </div>
      )}
    </article>
  );
}
