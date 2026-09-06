import type { ReactElement } from "react";

import { Link } from "@/core/i18n/navigation";

interface PublicVenueBackLinkProps {
  href: string;
  label: string;
}

export function PublicVenueBackLink({
  href,
  label,
}: PublicVenueBackLinkProps): ReactElement {
  return (
    <p>
      <Link
        href={href}
        scroll={false}
        data-testid="public-venue-back"
        className="inline-flex min-h-11 items-center rounded-md text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {label}
      </Link>
    </p>
  );
}
