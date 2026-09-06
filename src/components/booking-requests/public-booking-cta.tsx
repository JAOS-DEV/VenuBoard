import { Link } from "@/core/i18n/navigation";
import { publicVenueEnquirePath } from "@/core/booking-requests/public-path";
import type { PublicBookingIntakePayload } from "@/core/booking-requests/public-types";
import { Button } from "@/components/ui/button";

interface PublicBookingCtaProps {
  intake: PublicBookingIntakePayload;
  headingFallback: string;
  ctaLabel: string;
  intro: string;
}

export function PublicBookingCta({
  intake,
  headingFallback,
  ctaLabel,
  intro,
}: PublicBookingCtaProps): React.ReactElement | null {
  if (!intake.available || !intake.accepting) {
    return null;
  }

  const href = publicVenueEnquirePath(intake.venueSlug);
  if (href === null) {
    return null;
  }

  return (
    <section className="space-y-3" data-testid="public-booking-cta">
      <h2 className="text-lg font-semibold tracking-tight">
        {intake.heading ?? headingFallback}
      </h2>
      <p className="text-sm text-muted-foreground">{intro}</p>
      <Button asChild className="min-h-11 w-full sm:w-auto">
        <Link href={href}>{ctaLabel}</Link>
      </Button>
    </section>
  );
}
