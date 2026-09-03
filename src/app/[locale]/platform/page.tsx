import { getTranslations } from "next-intl/server";

import { EmptyState } from "@/components/patterns/empty-state";
import { PageHeader } from "@/components/patterns/page-header";
import { PaginationControls } from "@/components/patterns/pagination-controls";
import { StatusBadge } from "@/components/patterns/status-badge";
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
  const limit = platformVenueListLimit();

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("title")}
        actions={
          canOnboard ? (
            <Button asChild>
              <Link href="/platform/onboard">{t("onboardCta")}</Link>
            </Button>
          ) : null
        }
      />

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
          <h2 id="recent-venues" className="text-base font-semibold">
            {t("recentVenues")}
          </h2>
          <PaginationControls message={t("listLimit", { limit })} />
          {venues.length === 0 ? (
            <EmptyState title={t("empty")} />
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {venues.map((venue) => (
                <li key={venue.venueId}>
                  <Link
                    href={`/platform/venues/${venue.venueId}`}
                    className="flex min-h-11 flex-col gap-1 px-4 py-3 hover:bg-accent"
                  >
                    <span className="truncate font-medium">
                      {venue.venueName}
                    </span>
                    <span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <span className="truncate">{venue.businessName}</span>
                      <StatusBadge
                        label={
                          venue.publicationState === "published"
                            ? t("publicationPublished")
                            : t("publicationDraft")
                        }
                        variant={
                          venue.publicationState === "published"
                            ? "published"
                            : "draft"
                        }
                      />
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
