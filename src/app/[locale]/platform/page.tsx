import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { resolveRequestActor } from "@/core/actors/resolve";
import { canOnboardTenants } from "@/core/authz/can";
import { Link } from "@/core/i18n/navigation";
import { resolveRequestLocale } from "@/core/i18n/server";
import {
  listPlatformVenues,
  platformVenueListLimit,
} from "@/core/onboarding/queries";

interface PlatformPageProps {
  params: Promise<{ locale: string }>;
}

export default async function PlatformPage({
  params,
}: PlatformPageProps): Promise<React.ReactElement> {
  await resolveRequestLocale(params);
  const actor = await resolveRequestActor({ memberships: "platform" });
  const t = await getTranslations("platform");
  const canOnboard = canOnboardTenants(actor);
  const venues = canOnboard ? await listPlatformVenues() : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        {canOnboard && (
          <Button asChild>
            <Link href="/platform/onboard">{t("onboardCta")}</Link>
          </Button>
        )}
      </div>

      {!canOnboard && (
        <Card>
          <CardHeader>
            <CardTitle>{t("supportTitle")}</CardTitle>
            <CardDescription>{t("supportBody")}</CardDescription>
          </CardHeader>
        </Card>
      )}

      {canOnboard && (
        <section className="space-y-3" aria-labelledby="recent-venues">
          <h2 id="recent-venues" className="text-lg font-semibold">
            {t("recentVenues")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("listLimit", { limit: platformVenueListLimit() })}
          </p>
          {venues.length === 0 ? (
            <p>{t("empty")}</p>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {venues.map((venue) => (
                <li key={venue.venueId}>
                  <Link
                    href={`/platform/venues/${venue.venueId}`}
                    className="flex min-h-11 flex-col gap-1 px-4 py-3 hover:bg-accent"
                  >
                    <span className="font-medium">{venue.venueName}</span>
                    <span className="text-sm text-muted-foreground">
                      {venue.businessName} · {venue.slug} ·{" "}
                      {venue.publicationState}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
